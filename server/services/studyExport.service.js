import { randomUUID } from "node:crypto";

import GoogleWorkspaceConnection from "../models/GoogleWorkspaceConnection.js";
import StudyExport from "../models/StudyExport.js";
import {
  createGoogleFormsQuiz,
  normalizeGoogleFormsExportMode,
} from "./googleForms.service.js";
import {
  decryptSecret,
  encryptSecret,
} from "../utils/secretEncryption.js";

const EXPORT_LEASE_MS = 5 * 60 * 1000;
const EXPORT_WAIT_MS = 25 * 1000;
const EXPORT_WAIT_INTERVAL_MS = 300;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const completedExportFilter = (identity) => ({
  ...identity,
  externalId: { $nin: [null, ""] },
  $or: [
    { status: "created" },
    { status: { $exists: false } },
  ],
});

export const serializeStudyExport = (studyExport) => {
  if (!studyExport) return null;

  return {
    id: String(studyExport._id || studyExport.id || ""),
    exportType: studyExport.exportType || "google_forms",
    exportMode: studyExport.exportMode || "standard",
    externalId: studyExport.externalId || "",
    editUrl: studyExport.editUrl || "",
    responderUrl: studyExport.responderUrl || "",
    exportedAt: studyExport.exportedAt || studyExport.createdAt || null,
  };
};

export const saveGoogleFormsConnection = async ({ userId, refreshToken, scopes }) => {
  const existing = await GoogleWorkspaceConnection.findOne({ user: userId })
    .select("+encryptedRefreshToken");

  const encryptedRefreshToken = refreshToken
    ? encryptSecret(refreshToken)
    : existing?.encryptedRefreshToken;

  if (!encryptedRefreshToken) {
    const error = new Error(
      "Google did not return a refresh token. Reconnect Google Forms and approve access again.",
    );
    error.code = "GOOGLE_FORMS_REFRESH_TOKEN_MISSING";
    throw error;
  }

  return GoogleWorkspaceConnection.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        provider: "google_forms",
        encryptedRefreshToken,
        scopes: Array.isArray(scopes) ? scopes : [],
        connectedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
    },
  );
};

export const getGoogleFormsConnection = async (userId) =>
  GoogleWorkspaceConnection.findOne({ user: userId }).select("+encryptedRefreshToken");

export const removeGoogleFormsConnection = async (userId) =>
  GoogleWorkspaceConnection.deleteOne({ user: userId });

export const getExistingGoogleFormsExport = async ({
  userId,
  studySessionId,
  exportMode = null,
}) => {
  const filter = {
    user: userId,
    studySession: studySessionId,
    exportType: "google_forms",
    externalId: { $nin: [null, ""] },
    $or: [{ status: "created" }, { status: { $exists: false } }],
  };

  if (exportMode) {
    filter.exportMode = normalizeGoogleFormsExportMode(exportMode);
  }

  return StudyExport.findOne(filter).sort({ exportedAt: -1, createdAt: -1 }).lean();
};

const reserveGoogleFormsExport = async (identity) => {
  const now = new Date();
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + EXPORT_LEASE_MS);

  let claimed = await StudyExport.findOneAndUpdate(
    {
      ...identity,
      $or: [
        { status: "failed" },
        { status: "creating", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "creating",
        leaseToken,
        leaseExpiresAt,
        lastError: "",
      },
    },
    { returnDocument: "after" },
  ).select("+leaseToken +leaseExpiresAt");

  if (claimed) return { owned: true, leaseToken, studyExport: claimed };

  try {
    claimed = await StudyExport.create({
      ...identity,
      status: "creating",
      leaseToken,
      leaseExpiresAt,
      externalId: "",
      editUrl: "",
      responderUrl: "",
      exportedAt: null,
    });
    return { owned: true, leaseToken, studyExport: claimed };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const existing = await StudyExport.findOne(identity)
    .select("+leaseToken +leaseExpiresAt")
    .lean();
  return { owned: false, leaseToken: "", studyExport: existing };
};

const waitForGoogleFormsExport = async (identity) => {
  const deadline = Date.now() + EXPORT_WAIT_MS;
  while (Date.now() <= deadline) {
    const existing = await StudyExport.findOne(identity)
      .select("+leaseExpiresAt")
      .lean();

    if (existing?.externalId && (existing.status === "created" || !existing.status)) {
      return { completed: existing, retryable: false };
    }

    if (
      !existing ||
      existing.status === "failed" ||
      (existing.status === "creating" && existing.leaseExpiresAt && existing.leaseExpiresAt <= new Date())
    ) {
      return { completed: null, retryable: true };
    }

    await sleep(EXPORT_WAIT_INTERVAL_MS);
  }
  return { completed: null, retryable: false };
};

const createOrReuseGoogleFormsQuizExport = async ({
  userId,
  studySession,
  exportMode = "standard",
  retryReservation = true,
}) => {
  const normalizedExportMode = normalizeGoogleFormsExportMode(exportMode);
  const identity = {
    user: userId,
    studySession: studySession._id,
    exportType: "google_forms",
    exportMode: normalizedExportMode,
  };

  const existing = await StudyExport.findOne(completedExportFilter(identity)).lean();
  if (existing) return { created: false, studyExport: existing };

  const connection = await getGoogleFormsConnection(userId);
  if (!connection) {
    const error = new Error("Connect Google Forms before exporting this quiz.");
    error.code = "GOOGLE_FORMS_NOT_CONNECTED";
    throw error;
  }

  const reservation = await reserveGoogleFormsExport(identity);
  if (!reservation.owned) {
    const waited = await waitForGoogleFormsExport(identity);
    if (waited.completed) return { created: false, studyExport: waited.completed };
    if (waited.retryable && retryReservation) {
      return createOrReuseGoogleFormsQuizExport({
        userId,
        studySession,
        exportMode: normalizedExportMode,
        retryReservation: false,
      });
    }

    const error = new Error(
      "This Google Forms export is already being prepared. Please wait a moment and retry.",
    );
    error.code = "GOOGLE_FORMS_EXPORT_IN_PROGRESS";
    error.statusCode = 409;
    throw error;
  }

  const refreshToken = decryptSecret(connection.encryptedRefreshToken);
  let result;

  try {
    result = await createGoogleFormsQuiz({
      refreshToken,
      studySession,
      exportMode: normalizedExportMode,
    });

    const studyExport = await StudyExport.findOneAndUpdate(
      {
        _id: reservation.studyExport._id,
        status: "creating",
        leaseToken: reservation.leaseToken,
      },
      {
        $set: {
          status: "created",
          externalId: result.formId,
          editUrl: result.editUrl,
          responderUrl: result.responderUrl,
          exportedAt: new Date(),
          lastError: "",
        },
        $unset: { leaseToken: "", leaseExpiresAt: "" },
      },
      { returnDocument: "after" },
    );

    if (!studyExport) {
      const error = new Error("The Google Forms export could not be finalized safely.");
      error.code = "GOOGLE_FORMS_EXPORT_FINALIZE_FAILED";
      throw error;
    }

    await GoogleWorkspaceConnection.updateOne(
      { _id: connection._id },
      { $set: { lastUsedAt: new Date() } },
    );

    return { created: true, studyExport };
  } catch (error) {
    await StudyExport.updateOne(
      {
        _id: reservation.studyExport._id,
        status: "creating",
        leaseToken: reservation.leaseToken,
      },
      {
        $set: {
          status: "failed",
          lastError: String(error?.message || "Google Forms export failed.").slice(0, 500),
        },
        $unset: { leaseToken: "", leaseExpiresAt: "" },
      },
    ).catch(() => {});
    throw error;
  }
};

const googleFormsExportInFlight = new Map();

export const ensureGoogleFormsQuizExport = async ({
  userId,
  studySession,
  exportMode = "standard",
}) => {
  const normalizedExportMode = normalizeGoogleFormsExportMode(exportMode);
  const key = `${String(userId)}:${String(studySession?._id || "")}:${normalizedExportMode}`;
  const existingTask = googleFormsExportInFlight.get(key);
  if (existingTask) return existingTask;

  const task = createOrReuseGoogleFormsQuizExport({
    userId,
    studySession,
    exportMode: normalizedExportMode,
  });
  googleFormsExportInFlight.set(key, task);

  try {
    return await task;
  } finally {
    if (googleFormsExportInFlight.get(key) === task) {
      googleFormsExportInFlight.delete(key);
    }
  }
};