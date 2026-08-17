import mongoose from "mongoose";

import LearningProfile from "../models/LearningProfile.js";
import StudySession from "../models/StudySession.js";
import TutorConversation from "../models/TutorConversation.js";
import TutorMessage from "../models/TutorMessage.js";

import { generateTutorReply } from "../services/tutorGemini.service.js";
import {
  completeTutorQuestion,
  failTutorQuestion,
  getTutorUsageStatus,
  reserveTutorQuestion,
  TutorBusyError,
  TutorDailyLimitError,
  TutorInsufficientFluxGemsError,
  TutorRateLimitError,
} from "../services/tutorUsage.service.js";

const MAX_QUESTION_LENGTH = Math.max(
  Number(process.env.TUTOR_QUESTION_MAX_LENGTH || 2000),
  200,
);

const getHistoryMessageLimit = () =>
  Math.min(
    Math.max(
      Number(process.env.TUTOR_HISTORY_MESSAGES || 12),
      2,
    ),
    30,
  );

const buildProfileSnapshot = (profile) => ({
  educationLevel: profile.educationLevel || "",
  institutionType: profile.institutionType || "",
  institutionState: profile.institutionState || "",
  institutionId: profile.institutionId || "",
  institutionCategory: profile.institutionCategory || "",
  institutionSector: profile.institutionSector || "",
  institutionKey: profile.institutionKey || "",
  institutionName: profile.institutionName || "",
  programKey: profile.programKey || "",
  program: profile.program || "",
  streamKey: profile.streamKey || "",
  stream: profile.stream || "",
});

const getStudySessionTitle = (studySession) =>
  studySession?.output?.sessionTitle ||
  studySession?.topic ||
  studySession?.sourceFile?.fileName ||
  "";

const serializeMessage = (message) => ({
  id: message._id,
  role: message.role,
  content: message.content,
  sequence: Number(message.sequence || 0),
  status: message.status,
  billing:
    message.role === "user"
      ? {
          isFree: Boolean(message.billing?.isFree),
          cost: Number(message.billing?.cost || 0),
        }
      : undefined,
  modelUsed: message.role === "assistant"
    ? message.modelUsed || ""
    : undefined,
  fallbackUsed:
    message.role === "assistant"
      ? Boolean(message.fallbackUsed)
      : undefined,
  createdAt: message.createdAt,
  completedAt: message.completedAt,
});

const serializeConversation = (conversation) => ({
  id: conversation._id,
  title: conversation.title || "Tutor conversation",
  academicContext: conversation.academicContext || null,
  contextStudySession: conversation.contextStudySession
    ? {
        id:
          conversation.contextStudySession._id ||
          conversation.contextStudySession,
        title:
          conversation.contextStudySession.output?.sessionTitle ||
          conversation.contextStudySession.topic ||
          conversation.contextTitle ||
          "Saved learning session",
        generationType:
          conversation.contextStudySession.generationType || "",
      }
    : null,
  contextTitle: conversation.contextTitle || "",
  messageCount: Number(conversation.messageCount || 0),
  successfulQuestionCount: Number(
    conversation.successfulQuestionCount || 0,
  ),
  isGenerating: Boolean(conversation.isGenerating),
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const findOwnedConversation = async (userId, conversationId) => {
  if (!mongoose.isValidObjectId(conversationId)) {
    return null;
  }

  return TutorConversation.findOne({
    _id: conversationId,
    user: userId,
    archivedAt: null,
  });
};

export const getTutorUsage = async (req, res, next) => {
  try {
    const usage = await getTutorUsageStatus(req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        usage,
        balance: Number(req.user.fluxGems || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listTutorConversations = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 40);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 40, 1),
      80,
    );

    const conversations = await TutorConversation.find({
      user: req.user._id,
      archivedAt: null,
      messageCount: { $gt: 0 },
    })
      .populate({
        path: "contextStudySession",
        select: "generationType topic output.sessionTitle",
      })
      .sort({
        lastMessageAt: -1,
        updatedAt: -1,
      })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        conversations: conversations.map(serializeConversation),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createTutorConversation = async (req, res, next) => {
  try {
    if (!req.user.learningProfileCompleted) {
      return res.status(403).json({
        success: false,
        code: "LEARNING_PROFILE_REQUIRED",
        message:
          "Complete your learning profile before using AI Tutor.",
      });
    }

    const profile = await LearningProfile.findOne({
      user: req.user._id,
    }).lean();

    if (!profile) {
      return res.status(403).json({
        success: false,
        code: "LEARNING_PROFILE_REQUIRED",
        message:
          "Complete your learning profile before using AI Tutor.",
      });
    }

    const requestedStudySessionId = String(
      req.body?.studySessionId || "",
    ).trim();

    let studySession = null;

    if (requestedStudySessionId) {
      if (!mongoose.isValidObjectId(requestedStudySessionId)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_TUTOR_CONTEXT",
          message: "Choose a valid Study Library item.",
        });
      }

      studySession = await StudySession.findOne({
        _id: requestedStudySessionId,
        user: req.user._id,
        status: "completed",
      })
        .select(
          "generationType topic sourceFile output.sessionTitle output.shortDescription",
        )
        .lean();

      if (!studySession) {
        return res.status(404).json({
          success: false,
          code: "TUTOR_CONTEXT_NOT_FOUND",
          message:
            "The selected Study Library item could not be found.",
        });
      }
    }

    const contextTitle = getStudySessionTitle(studySession);

    const conversation = await TutorConversation.create({
      user: req.user._id,
      title: contextTitle
        ? `Tutor: ${contextTitle}`.slice(0, 100)
        : "New tutor chat",
      academicContext: buildProfileSnapshot(profile),
      contextStudySession: studySession?._id || null,
      contextTitle,
    });

    return res.status(201).json({
      success: true,
      message: "Tutor conversation created.",
      data: {
        conversation: serializeConversation(conversation),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTutorConversation = async (req, res, next) => {
  try {
    const conversation = await findOwnedConversation(
      req.user._id,
      req.params.conversationId,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_CONVERSATION_NOT_FOUND",
        message: "Tutor conversation not found.",
      });
    }

    await conversation.populate({
      path: "contextStudySession",
      select: "generationType topic output.sessionTitle",
    });

    const messages = await TutorMessage.find({
      user: req.user._id,
      conversation: conversation._id,
      status: "completed",
    })
      .sort({ sequence: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        conversation: serializeConversation(conversation),
        messages: messages.map(serializeMessage),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const archiveTutorConversation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_CONVERSATION_NOT_FOUND",
        message: "Tutor conversation not found.",
      });
    }

    const conversation = await TutorConversation.findOneAndUpdate(
      {
        _id: req.params.conversationId,
        user: req.user._id,
        archivedAt: null,
        isGenerating: false,
      },
      {
        $set: {
          archivedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    if (!conversation) {
      return res.status(409).json({
        success: false,
        code: "TUTOR_CONVERSATION_BUSY_OR_NOT_FOUND",
        message:
          "This Tutor conversation could not be removed right now.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tutor conversation removed from history.",
    });
  } catch (error) {
    next(error);
  }
};

export const sendTutorMessage = async (req, res, next) => {
  const question = String(req.body?.message || "")
    .trim()
    .replace(/\r\n/g, "\n");

  if (!question) {
    return res.status(400).json({
      success: false,
      code: "TUTOR_MESSAGE_REQUIRED",
      message: "Enter a question for AI Tutor.",
    });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      success: false,
      code: "TUTOR_MESSAGE_TOO_LONG",
      message: `Tutor questions can be up to ${MAX_QUESTION_LENGTH} characters.`,
    });
  }

  const conversation = await findOwnedConversation(
    req.user._id,
    req.params.conversationId,
  );

  if (!conversation) {
    return res.status(404).json({
      success: false,
      code: "TUTOR_CONVERSATION_NOT_FOUND",
      message: "Tutor conversation not found.",
    });
  }

  let reservation;

  try {
    reservation = await reserveTutorQuestion({
      userId: req.user._id,
      conversationId: conversation._id,
      question,
    });
  } catch (error) {
    if (error instanceof TutorInsufficientFluxGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          required: error.required,
          balance: Number(req.user.fluxGems || 0),
        },
      });
    }

    if (error instanceof TutorBusyError) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof TutorRateLimitError) {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          retryAfterMs: error.retryAfterMs,
        },
      });
    }

    if (error instanceof TutorDailyLimitError) {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          limit: error.limit,
        },
      });
    }

    if (error?.code === "TUTOR_CONVERSATION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  }

  try {
    const historyLimit = getHistoryMessageLimit();

    const priorMessagesDescending = await TutorMessage.find({
      user: req.user._id,
      conversation: conversation._id,
      status: "completed",
    })
      .sort({ sequence: -1 })
      .limit(historyLimit)
      .lean();

    const history = priorMessagesDescending.reverse();

    let studySession = null;

    if (conversation.contextStudySession) {
      studySession = await StudySession.findOne({
        _id: conversation.contextStudySession,
        user: req.user._id,
        status: "completed",
      })
        .select(
          "generationType topic sourceFile output academicContext",
        )
        .lean();
    }

    const generation = await generateTutorReply({
      academicContext: conversation.academicContext,
      studySession,
      history,
      question,
    });

    const assistantMessage = await completeTutorQuestion({
      userId: req.user._id,
      conversationId: conversation._id,
      reservation,
      reply: generation.text,
      modelUsed: generation.modelUsed,
      fallbackUsed: generation.fallbackUsed,
    });

    const usage = await getTutorUsageStatus(req.user._id);

    return res.status(201).json({
      success: true,
      message: generation.fallbackUsed
        ? "AI Tutor replied using the fallback Gemini model."
        : "AI Tutor replied successfully.",
      data: {
        userMessage: {
          id: reservation.userMessageId,
          role: "user",
          content: question,
          sequence: reservation.userSequence,
          status: "completed",
          billing: {
            isFree: reservation.isFree,
            cost: reservation.cost,
          },
        },
        assistantMessage: serializeMessage(assistantMessage),
        billing: {
          isFree: reservation.isFree,
          charged: reservation.cost,
          balance:
            reservation.balance ??
            Number(req.user.fluxGems || 0),
        },
        usage,
      },
    });
  } catch (generationError) {
    let failure = {
      refunded: false,
      balance: reservation.balance,
    };

    try {
      failure = await failTutorQuestion({
        userId: req.user._id,
        conversationId: conversation._id,
        reservation,
        failureCode:
          generationError.code || "AI_TUTOR_FAILED",
        failureMessage:
          generationError.message || "AI Tutor failed.",
      });
    } catch (refundError) {
      console.error(
        "CRITICAL: Tutor usage rollback/refund failed:",
        refundError,
      );
    }

    return res.status(503).json({
      success: false,
      code:
        generationError.code || "AI_TUTOR_FAILED",
      message: reservation.isFree
        ? "AI Tutor could not answer, so your free question was not consumed. Please try again."
        : failure.refunded
          ? `AI Tutor could not answer, so your ${reservation.cost} FluxGems were returned. Please try again.`
          : "AI Tutor could not answer. Please try again.",
      data: {
        refunded: failure.refunded,
        balance: failure.balance,
      },
    });
  }
};
