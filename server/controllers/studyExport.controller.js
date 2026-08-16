import mongoose from "mongoose";

import StudySession from "../models/StudySession.js";
import {
  createGoogleFormsOauthState,
  exchangeGoogleFormsAuthorizationCode,
  getGoogleFormsAuthorizationUrl,
  isGoogleFormsReconnectError,
  verifyGoogleFormsOauthState,
} from "../services/googleForms.service.js";
import { createNotesPdfBuffer } from "../services/notesPdf.service.js";
import {
  ensureGoogleFormsQuizExport,
  getExistingGoogleFormsExport,
  getGoogleFormsConnection,
  removeGoogleFormsConnection,
  saveGoogleFormsConnection,
  serializeStudyExport,
} from "../services/studyExport.service.js";

const getClientUrl = () =>
  String(
    process.env.CLIENT_URL ||
      "http://localhost:5173",
  ).replace(/\/+$/, "");

const getStudyReturnUrl = (
  sessionId,
  status,
) => {
  const params = new URLSearchParams({
    tab: "quiz",
    googleForms: status,
  });

  return `${getClientUrl()}/study/${encodeURIComponent(
    sessionId,
  )}?${params.toString()}`;
};

const getGoogleFormsErrorReturnUrl = (
  sessionId = "",
) => {
  if (sessionId) {
    return getStudyReturnUrl(
      sessionId,
      "error",
    );
  }

  return `${getClientUrl()}/library?googleForms=error`;
};

const findOwnedCompletedSession = async ({
  sessionId,
  userId,
}) => {
  if (!mongoose.isValidObjectId(sessionId)) {
    return null;
  }

  return StudySession.findOne({
    _id: sessionId,
    user: userId,
    status: "completed",
  });
};

const requireQuiz = (studySession) => {
  const questions =
    studySession?.output?.quiz?.questions;

  if (
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    const error = new Error(
      "This learning item does not contain a quiz.",
    );
    error.code = "QUIZ_NOT_AVAILABLE";
    throw error;
  }
};

const requireNotes = (studySession) => {
  if (!studySession?.output?.notes) {
    const error = new Error(
      "This learning item does not contain AI Notes.",
    );
    error.code = "NOTES_NOT_AVAILABLE";
    throw error;
  }
};

const makePdfFilename = (title) => {
  const cleaned = String(
    title || "studyfluxai-notes",
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${
    cleaned || "studyfluxai-notes"
  }-notes.pdf`;
};

export const downloadNotesPdf = async (
  req,
  res,
  next,
) => {
  try {
    const studySession =
      await findOwnedCompletedSession({
        sessionId: req.params.sessionId,
        userId: req.user._id,
      });

    if (!studySession) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    try {
      requireNotes(studySession);
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    const pdfBuffer =
      await createNotesPdfBuffer(
        studySession.toObject(),
      );

    const filename = makePdfFilename(
      studySession.output?.sessionTitle,
    );

    res.setHeader(
      "Content-Type",
      "application/pdf",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader(
      "Content-Length",
      String(pdfBuffer.length),
    );
    res.setHeader(
      "Cache-Control",
      "private, no-store",
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const getGoogleFormsStatus = async (
  req,
  res,
  next,
) => {
  try {
    const connection =
      await getGoogleFormsConnection(
        req.user._id,
      );

    return res.status(200).json({
      success: true,
      data: {
        connected: Boolean(connection),
        connectedAt:
          connection?.connectedAt || null,
        lastUsedAt:
          connection?.lastUsedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const connectGoogleForms = async (
  req,
  res,
  next,
) => {
  try {
    const sessionId = String(
      req.query.sessionId || "",
    ).trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        code: "SESSION_ID_REQUIRED",
        message:
          "Choose a saved quiz before connecting Google Forms.",
      });
    }

    const studySession =
      await findOwnedCompletedSession({
        sessionId,
        userId: req.user._id,
      });

    if (!studySession) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    try {
      requireQuiz(studySession);
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    const state =
      createGoogleFormsOauthState({
        userId: req.user._id,
        sessionId,
      });

    const authorizationUrl =
      getGoogleFormsAuthorizationUrl({
        state,
      });

    return res.redirect(authorizationUrl);
  } catch (error) {
    next(error);
  }
};

export const googleFormsCallback = async (
  req,
  res,
) => {
  let stateData = null;

  try {
    stateData =
      verifyGoogleFormsOauthState(
        req.query.state,
      );

    if (req.query.error) {
      return res.redirect(
        getStudyReturnUrl(
          stateData.sessionId,
          "cancelled",
        ),
      );
    }

    const code = String(
      req.query.code || "",
    ).trim();

    if (!code) {
      return res.redirect(
        getGoogleFormsErrorReturnUrl(
          stateData.sessionId,
        ),
      );
    }

    const {
      refreshToken,
      scopes,
    } =
      await exchangeGoogleFormsAuthorizationCode(
        code,
      );

    await saveGoogleFormsConnection({
      userId: stateData.userId,
      refreshToken,
      scopes,
    });

    const studySession =
      await findOwnedCompletedSession({
        sessionId: stateData.sessionId,
        userId: stateData.userId,
      });

    if (!studySession) {
      return res.redirect(
        getGoogleFormsErrorReturnUrl(
          stateData.sessionId,
        ),
      );
    }

    requireQuiz(studySession);

    await ensureGoogleFormsQuizExport({
      userId: stateData.userId,
      studySession,
    });

    return res.redirect(
      getStudyReturnUrl(
        stateData.sessionId,
        "exported",
      ),
    );
  } catch (error) {
    console.error(
      "Google Forms OAuth callback failed:",
      error,
    );

    return res.redirect(
      getGoogleFormsErrorReturnUrl(
        stateData?.sessionId || "",
      ),
    );
  }
};

export const disconnectGoogleForms =
  async (req, res, next) => {
    try {
      await removeGoogleFormsConnection(
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message:
          "Google Forms connection removed from StudyFluxAI.",
      });
    } catch (error) {
      next(error);
    }
  };

export const getGoogleFormsExport = async (
  req,
  res,
  next,
) => {
  try {
    const studySession =
      await findOwnedCompletedSession({
        sessionId: req.params.sessionId,
        userId: req.user._id,
      });

    if (!studySession) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    const studyExport =
      await getExistingGoogleFormsExport({
        userId: req.user._id,
        studySessionId:
          studySession._id,
      });

    return res.status(200).json({
      success: true,
      data: {
        studyExport:
          serializeStudyExport(
            studyExport,
          ),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const exportQuizToGoogleForms =
  async (req, res, next) => {
    try {
      const studySession =
        await findOwnedCompletedSession({
          sessionId: req.params.sessionId,
          userId: req.user._id,
        });

      if (!studySession) {
        return res.status(404).json({
          success: false,
          code: "STUDY_SESSION_NOT_FOUND",
          message: "Learning item not found.",
        });
      }

      try {
        requireQuiz(studySession);
      } catch (error) {
        return res.status(400).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      const result =
        await ensureGoogleFormsQuizExport({
          userId: req.user._id,
          studySession,
        });

      return res.status(
        result.created ? 201 : 200,
      ).json({
        success: true,
        message: result.created
          ? "Quiz exported to Google Forms."
          : "This quiz has already been exported to Google Forms.",
        data: {
          created: result.created,
          studyExport:
            serializeStudyExport(
              result.studyExport,
            ),
        },
      });
    } catch (error) {
      if (
        error?.code ===
        "GOOGLE_FORMS_NOT_CONNECTED"
      ) {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (
        error?.code ===
          "INVALID_QUIZ_EXPORT_DATA" ||
        error?.code ===
          "QUIZ_NOT_AVAILABLE"
      ) {
        return res.status(400).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (
        error?.code ===
          "GOOGLE_TOKEN_DECRYPT_FAILED" ||
        isGoogleFormsReconnectError(
          error,
        )
      ) {
        await removeGoogleFormsConnection(
          req.user._id,
        );

        return res.status(409).json({
          success: false,
          code:
            "GOOGLE_FORMS_RECONNECT_REQUIRED",
          message:
            "Your Google Forms authorization expired or was revoked. Reconnect Google Forms and try again.",
        });
      }

      if (
        error?.code ===
          "GOOGLE_TOKEN_ENCRYPTION_NOT_CONFIGURED" ||
        error?.code ===
          "GOOGLE_FORMS_NOT_CONFIGURED"
      ) {
        return res.status(500).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      console.error(
        "Google Forms export failed:",
        error,
      );

      return res.status(502).json({
        success: false,
        code:
          "GOOGLE_FORMS_EXPORT_FAILED",
        message:
          "Google Forms could not create this quiz. Please try again.",
      });
    }
  };
