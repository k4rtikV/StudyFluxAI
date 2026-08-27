import { getNumberEnv } from "../config/env.js";
import StudySession from "../models/StudySession.js";
import { safeErrorDetails } from "../utils/safeError.js";
import { emitStudySessionChanged } from "../realtime/socket.js";
import { refundFailedStudyGeneration } from "./fluxGem.service.js";
import { generateLearningSession } from "./gemini.service.js";
import { queueLeaderboardRefresh } from "./leaderboard.service.js";
import { createUserNotification } from "./notification.service.js";

const CONCURRENCY = getNumberEnv("STUDY_GENERATION_CONCURRENCY", 2);
const STALE_GENERATION_MS = getNumberEnv("STUDY_GENERATION_STALE_MS", 5 * 60 * 1000, {
  min: 2 * 60 * 1000,
});
const MAX_QUEUE_DEPTH = Math.max(
  getNumberEnv("STUDY_GENERATION_QUEUE_MAX", 50),
  CONCURRENCY,
);
const MAX_RETAINED_BYTES = getNumberEnv(
  "STUDY_GENERATION_QUEUE_MAX_BYTES",
  64 * 1024 * 1024,
  { min: 10 * 1024 * 1024, max: 512 * 1024 * 1024 },
);

const pendingJobs = [];
const trackedSessionIds = new Set();
let activeJobs = 0;
let retainedBytes = 0;
let recoveryTimer = null;

const getJobRetainedBytes = (job) =>
  Math.max(
    Number(job?.generationInput?.sourceFile?.buffer?.length || 0),
    Number(job?.generationInput?.sourceFile?.size || 0),
    0,
  );

const emitStatus = (studySessionId, payload) => {
  emitStudySessionChanged(studySessionId, payload);
};

const updateStage = async ({
  studySessionId,
  userId,
  stage,
  model = "",
  primaryError = null,
}) => {
  const now = new Date();
  const set = {
    generationStage: stage,
  };

  if (stage === "primary") {
    set["generationMetrics.startedAt"] = now;
    set["generationMetrics.primaryStartedAt"] = now;
  }

  if (stage === "fallback") {
    set["generationMetrics.fallbackStartedAt"] = now;
    set.fallbackUsed = true;
  }

  if (model) {
    set.modelUsed = model;
  }

  if (primaryError?.code) {
    set.failureCode = String(primaryError.code).slice(0, 120);
  }

  await StudySession.updateOne(
    {
      _id: studySessionId,
      user: userId,
      status: "generating",
    },
    { $set: set },
  );

  emitStatus(studySessionId, {
    status: "generating",
    generationStage: stage,
  });
};

const processJob = async (job) => {
  const {
    studySessionId,
    userId,
    cost,
    generationInput,
  } = job;

  try {
    const generation = await generateLearningSession({
      ...generationInput,
      onStageChange: async (stage, details = {}) => {
        try {
          await updateStage({
            studySessionId,
            userId,
            stage,
            model: details.model,
            primaryError: details.primaryError,
          });
        } catch (error) {
          console.warn(
            `Study session ${studySessionId} stage update failed:`,
            safeErrorDetails(error),
          );
        }
      },
    });

    const completedAt = new Date();
    const timings = generation.timings || {};

    const completedSession = await StudySession.findOneAndUpdate(
      {
        _id: studySessionId,
        user: userId,
        status: "generating",
      },
      {
        $set: {
          status: "completed",
          generationStage: "completed",
          modelUsed: generation.modelUsed,
          fallbackUsed: generation.fallbackUsed,
          output: generation.output,
          completedAt,
          failureCode: "",
          failureMessage: "",
          "generationMetrics.primaryDurationMs": Number(
            timings.primaryDurationMs || 0,
          ),
          "generationMetrics.fallbackDurationMs": Number(
            timings.fallbackDurationMs || 0,
          ),
          "generationMetrics.totalDurationMs": Number(
            timings.totalDurationMs || 0,
          ),
          "generationMetrics.finishedAt": completedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!completedSession) {
      throw new Error("The generated learning content could not be saved.");
    }

    queueLeaderboardRefresh(userId);
    emitStatus(studySessionId, {
      status: "completed",
      generationStage: "completed",
      fallbackUsed: Boolean(generation.fallbackUsed),
    });

    createUserNotification({
      userId,
      type: "system",
      title: "Your study material is ready",
      body: `${completedSession.output?.sessionTitle || completedSession.topic || "Your StudyFluxAI generation"} finished generating.`,
      actionUrl: `/study/${String(studySessionId)}`,
      actionLabel: "Open session",
      priority: "normal",
      dedupeKey: `study-session:${String(studySessionId)}:completed`,
      emailRequested: false,
      metadata: { studySessionId: String(studySessionId), status: "completed" },
    }).catch((error) => console.warn("Study generation notification failed:", safeErrorDetails(error)));
  } catch (generationError) {
    try {
      const refundResult = await refundFailedStudyGeneration({
        userId,
        studySessionId,
        cost,
        failureCode: generationError.code || "AI_GENERATION_FAILED",
        failureMessage:
          generationError.message || "AI generation failed.",
      });

      if (generationError.generationTimings) {
        await StudySession.updateOne(
          { _id: studySessionId, user: userId },
          {
            $set: {
              "generationMetrics.primaryDurationMs": Number(
                generationError.generationTimings.primaryDurationMs || 0,
              ),
              "generationMetrics.fallbackDurationMs": Number(
                generationError.generationTimings.fallbackDurationMs || 0,
              ),
              "generationMetrics.totalDurationMs": Number(
                generationError.generationTimings.totalDurationMs || 0,
              ),
            },
          },
        );
      }

      emitStatus(studySessionId, {
        status: "failed",
        generationStage: "failed",
        refunded: Boolean(refundResult.refunded),
      });

      createUserNotification({
        userId,
        type: "system",
        title: "Study generation needs attention",
        body: refundResult.refunded
          ? "The AI generation failed and your FluxGems were refunded. Open Study Library to review or try again."
          : "The AI generation failed. Open Study Library to review the saved status.",
        actionUrl: "/library",
        actionLabel: "Open Study Library",
        priority: "high",
        dedupeKey: `study-session:${String(studySessionId)}:failed`,
        emailRequested: false,
        metadata: { studySessionId: String(studySessionId), status: "failed", refunded: Boolean(refundResult.refunded) },
      }).catch((error) => console.warn("Study generation failure notification failed:", safeErrorDetails(error)));
    } catch (refundError) {
      console.error(
        "CRITICAL: FluxGem refund failed after background AI generation error:",
        safeErrorDetails(refundError),
      );
      emitStatus(studySessionId, {
        status: "failed",
        generationStage: "failed",
        refunded: false,
      });
    }
  }
};

const drainQueue = () => {
  while (activeJobs < CONCURRENCY && pendingJobs.length > 0) {
    const job = pendingJobs.shift();
    activeJobs += 1;

    setImmediate(async () => {
      try {
        await processJob(job);
      } finally {
        activeJobs -= 1;
        retainedBytes = Math.max(0, retainedBytes - getJobRetainedBytes(job));
        trackedSessionIds.delete(String(job.studySessionId));
        drainQueue();
      }
    });
  }
};

export const enqueueStudyGeneration = (job) => {
  const jobBytes = getJobRetainedBytes(job);
  if (
    activeJobs + pendingJobs.length >= MAX_QUEUE_DEPTH ||
    retainedBytes + jobBytes > MAX_RETAINED_BYTES
  ) {
    const error = new Error("Study generation is temporarily at capacity. Please retry shortly.");
    error.code = "STUDY_GENERATION_QUEUE_FULL";
    error.statusCode = 503;
    throw error;
  }

  trackedSessionIds.add(String(job.studySessionId));
  retainedBytes += jobBytes;
  pendingJobs.push(job);
  emitStatus(job.studySessionId, {
    status: "generating",
    generationStage: "queued",
  });
  drainQueue();
};

export const recoverStaleStudyGenerations = async () => {
  const cutoff = new Date(Date.now() - STALE_GENERATION_MS);
  const staleSessions = await StudySession.find({
    status: "generating",
    updatedAt: { $lte: cutoff },
  })
    .select("_id user cost")
    .lean();

  let recovered = 0;

  for (const session of staleSessions) {
    if (trackedSessionIds.has(String(session._id))) {
      continue;
    }

    try {
      const result = await refundFailedStudyGeneration({
        userId: session.user,
        studySessionId: session._id,
        cost: Number(session.cost || 0),
        failureCode: "GENERATION_STALE_RECOVERY",
        failureMessage:
          "The generation worker stopped before this session completed.",
      });

      if (result.refunded) {
        recovered += 1;
        emitStatus(session._id, {
          status: "failed",
          generationStage: "failed",
          refunded: true,
        });
      }
    } catch (error) {
      console.error(
        `Failed to recover stale study session ${session._id}:`,
        safeErrorDetails(error),
      );
    }
  }

  if (recovered > 0) {
    console.warn(`Recovered and refunded ${recovered} stale study generation(s).`);
  }

  return recovered;
};

export const startStudyGenerationRecoverySweep = () => {
  if (recoveryTimer) return;

  recoveryTimer = setInterval(() => {
    recoverStaleStudyGenerations().catch((error) => {
      console.error("Study generation recovery sweep failed:", safeErrorDetails(error));
    });
  }, 60 * 1000);

  recoveryTimer.unref?.();
};

export const stopStudyGenerationRecoverySweep = () => {
  if (recoveryTimer) clearInterval(recoveryTimer);
  recoveryTimer = null;
};

export const getStudyGenerationWorkerStatus = () => ({
  active: activeJobs,
  pending: pendingJobs.length,
  tracked: trackedSessionIds.size,
  capacity: MAX_QUEUE_DEPTH,
  retainedBytes,
  retainedByteCapacity: MAX_RETAINED_BYTES,
  idle: activeJobs === 0 && pendingJobs.length === 0,
});