import StudySession from "../models/StudySession.js";
import { emitStudySessionChanged } from "../realtime/socket.js";
import { refundFailedStudyGeneration } from "./fluxGem.service.js";
import { generateLearningSession } from "./gemini.service.js";
import { queueLeaderboardRefresh } from "./leaderboard.service.js";

const CONCURRENCY = Math.max(
  Number(process.env.STUDY_GENERATION_CONCURRENCY || 2),
  1,
);
const STALE_GENERATION_MS = Math.max(
  Number(process.env.STUDY_GENERATION_STALE_MS || 5 * 60 * 1000),
  2 * 60 * 1000,
);

const pendingJobs = [];
const trackedSessionIds = new Set();
let activeJobs = 0;
let recoveryTimer = null;

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
            error.message,
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
    } catch (refundError) {
      console.error(
        "CRITICAL: FluxGem refund failed after background AI generation error:",
        refundError,
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
        trackedSessionIds.delete(String(job.studySessionId));
        drainQueue();
      }
    });
  }
};

export const enqueueStudyGeneration = (job) => {
  trackedSessionIds.add(String(job.studySessionId));
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
        error,
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
      console.error("Study generation recovery sweep failed:", error);
    });
  }, 60 * 1000);

  recoveryTimer.unref?.();
};
