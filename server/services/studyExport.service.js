import GoogleWorkspaceConnection from "../models/GoogleWorkspaceConnection.js";
import StudyExport from "../models/StudyExport.js";
import { createGoogleFormsQuiz } from "./googleForms.service.js";
import {
  decryptSecret,
  encryptSecret,
} from "../utils/secretEncryption.js";

export const serializeStudyExport = (
  studyExport,
) => {
  if (!studyExport) {
    return null;
  }

  return {
    id: String(
      studyExport._id || studyExport.id || "",
    ),
    exportType:
      studyExport.exportType || "google_forms",
    externalId: studyExport.externalId || "",
    editUrl: studyExport.editUrl || "",
    responderUrl: studyExport.responderUrl || "",
    exportedAt:
      studyExport.exportedAt ||
      studyExport.createdAt ||
      null,
  };
};

export const saveGoogleFormsConnection =
  async ({
    userId,
    refreshToken,
    scopes,
  }) => {
    const existing =
      await GoogleWorkspaceConnection.findOne({
        user: userId,
      }).select("+encryptedRefreshToken");

    const encryptedRefreshToken = refreshToken
      ? encryptSecret(refreshToken)
      : existing?.encryptedRefreshToken;

    if (!encryptedRefreshToken) {
      const error = new Error(
        "Google did not return a refresh token. Reconnect Google Forms and approve access again.",
      );
      error.code =
        "GOOGLE_FORMS_REFRESH_TOKEN_MISSING";
      throw error;
    }

    const connection =
      await GoogleWorkspaceConnection.findOneAndUpdate(
        {
          user: userId,
        },
        {
          $set: {
            provider: "google_forms",
            encryptedRefreshToken,
            scopes: Array.isArray(scopes)
              ? scopes
              : [],
            connectedAt: new Date(),
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        },
      );

    return connection;
  };

export const getGoogleFormsConnection =
  async (userId) =>
    GoogleWorkspaceConnection.findOne({
      user: userId,
    }).select("+encryptedRefreshToken");

export const removeGoogleFormsConnection =
  async (userId) =>
    GoogleWorkspaceConnection.deleteOne({
      user: userId,
    });

export const getExistingGoogleFormsExport =
  async ({
    userId,
    studySessionId,
  }) =>
    StudyExport.findOne({
      user: userId,
      studySession: studySessionId,
      exportType: "google_forms",
    }).lean();

export const ensureGoogleFormsQuizExport =
  async ({
    userId,
    studySession,
  }) => {
    const existing =
      await getExistingGoogleFormsExport({
        userId,
        studySessionId: studySession._id,
      });

    if (existing) {
      return {
        created: false,
        studyExport: existing,
      };
    }

    const connection =
      await getGoogleFormsConnection(userId);

    if (!connection) {
      const error = new Error(
        "Connect Google Forms before exporting this quiz.",
      );
      error.code =
        "GOOGLE_FORMS_NOT_CONNECTED";
      throw error;
    }

    const refreshToken = decryptSecret(
      connection.encryptedRefreshToken,
    );

    const result =
      await createGoogleFormsQuiz({
        refreshToken,
        studySession,
      });

    let studyExport;

    try {
      studyExport = await StudyExport.create({
        user: userId,
        studySession: studySession._id,
        exportType: "google_forms",
        externalId: result.formId,
        editUrl: result.editUrl,
        responderUrl: result.responderUrl,
        exportedAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      studyExport =
        await StudyExport.findOne({
          user: userId,
          studySession: studySession._id,
          exportType: "google_forms",
        });

      if (!studyExport) {
        throw error;
      }
    }

    await GoogleWorkspaceConnection.updateOne(
      {
        _id: connection._id,
      },
      {
        $set: {
          lastUsedAt: new Date(),
        },
      },
    );

    return {
      created: true,
      studyExport,
    };
  };
