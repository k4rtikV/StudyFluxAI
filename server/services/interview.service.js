import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import { getRedisClient } from "../config/redis.js";
import FluxGemTransaction from "../models/FluxGemTransaction.js";
import InterviewSession from "../models/InterviewSession.js";
import LearningProfile from "../models/LearningProfile.js";
import User from "../models/User.js";
import { acquireDistributedLock, waitForCondition } from "../utils/distributedLock.js";
import {
  evaluateInterviewAnswer,
  generateFirstInterviewQuestion,
  generateInterviewQuestionAudio,
} from "./interviewGemini.service.js";
import { queueSmartInterviewReport } from "./interviewReport.service.js";
import { queueLeaderboardRefresh } from "./leaderboard.service.js";
import {
  stampInterviewCompletionDay,
  syncSmartInterviewProgression,
} from "./interviewProgression.service.js";

const configuredInterviewCost = Number(process.env.INTERVIEW_FLUXGEM_COST || 100);
export const INTERVIEW_COST =
  Number.isInteger(configuredInterviewCost) && configuredInterviewCost > 0
    ? configuredInterviewCost
    : 100;

const configuredQuestionCount = Number(process.env.INTERVIEW_QUESTION_COUNT || 8);
export const INTERVIEW_QUESTION_COUNT =
  Number.isInteger(configuredQuestionCount) && configuredQuestionCount >= 3 && configuredQuestionCount <= 15
    ? configuredQuestionCount
    : 8;

export const INTERVIEW_ELIGIBLE_EDUCATION_LEVELS = new Set([
  "bachelors",
  "masters",
  "mba",
  "phd",
]);

const initializeFlights = new Map();
const answerFlights = new Map();
const questionAudioCache = new Map();
const questionAudioFlights = new Map();
const QUESTION_AUDIO_CACHE_LIMIT = 80;

const singleFlight = (map, key, operation) => {
  if (map.has(key)) return map.get(key);
  const promise = Promise.resolve()
    .then(operation)
    .finally(() => map.delete(key));
  map.set(key, promise);
  return promise;
};

const putAudioCache = (key, value) => {
  if (questionAudioCache.size >= QUESTION_AUDIO_CACHE_LIMIT) {
    const firstKey = questionAudioCache.keys().next().value;
    if (firstKey) questionAudioCache.delete(firstKey);
  }
  questionAudioCache.set(key, value);
};

const logInterviewTiming = (event, details = {}) => {
  if (String(process.env.INTERVIEW_TIMING_LOGS || "true").toLowerCase() === "false") return;
  console.info(`[smart-interview] ${event}`, details);
};

const audioCacheKey = ({ interviewId, questionId, voice }) =>
  `${interviewId}:${questionId}:${voice || "Kore"}`;

const redisAudioKey = (cacheKey) => `studyflux:interview:audio:${cacheKey}`;

const getRedisQuestionAudio = async (cacheKey) => {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(redisAudioKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.wavBase64) return null;
    return {
      wav: Buffer.from(parsed.wavBase64, "base64"),
      voice: parsed.voice || "Kore",
      model: parsed.model || "",
      usedFallback: Boolean(parsed.usedFallback),
      durationMs: Number(parsed.durationMs || 0),
      generatedAt: Number(parsed.generatedAt || Date.now()),
    };
  } catch {
    return null;
  }
};

const setRedisQuestionAudio = async (cacheKey, audio) => {
  const client = getRedisClient();
  if (!client || !audio?.wav) return;
  try {
    await client.set(
      redisAudioKey(cacheKey),
      JSON.stringify({
        wavBase64: audio.wav.toString("base64"),
        voice: audio.voice || "Kore",
        model: audio.model || "",
        usedFallback: Boolean(audio.usedFallback),
        durationMs: Number(audio.durationMs || 0),
        generatedAt: Number(audio.generatedAt || Date.now()),
      }),
      { EX: 600 },
    );
  } catch {
    // Redis audio caching is an optimization; on-demand TTS remains authoritative.
  }
};

const generateCachedQuestionAudio = ({ interviewId, question, voice = "Kore" }) => {
  const cacheKey = audioCacheKey({ interviewId, questionId: question.id, voice });
  if (questionAudioCache.has(cacheKey)) {
    return Promise.resolve({ ...questionAudioCache.get(cacheKey), cacheStatus: "memory-hit" });
  }

  return singleFlight(questionAudioFlights, cacheKey, async () => {
    if (questionAudioCache.has(cacheKey)) {
      return { ...questionAudioCache.get(cacheKey), cacheStatus: "memory-hit" };
    }

    const redisHit = await getRedisQuestionAudio(cacheKey);
    if (redisHit) {
      putAudioCache(cacheKey, redisHit);
      return { ...redisHit, cacheStatus: "redis-hit" };
    }

    let lock = await acquireDistributedLock(`interview:tts:${cacheKey}`, 60000);
    if (!lock.acquired) {
      const shared = await waitForCondition(
        () => getRedisQuestionAudio(cacheKey),
        { timeoutMs: 45000, intervalMs: 250 },
      );
      if (shared) {
        putAudioCache(cacheKey, shared);
        return { ...shared, cacheStatus: "redis-wait-hit" };
      }

      // The first lease may have expired after a crashed worker. Take a fresh
      // lease before generating instead of starting a duplicate Gemini TTS call.
      lock = await acquireDistributedLock(`interview:tts:${cacheKey}`, 60000);
      if (!lock.acquired) {
        throw new InterviewStateError(
          "Astra's voice is still being prepared. Try again in a moment or answer from the visible question.",
          "INTERVIEW_TTS_BUSY",
          503,
        );
      }
    }

    try {
      const secondRedisHit = await getRedisQuestionAudio(cacheKey);
      if (secondRedisHit) {
        putAudioCache(cacheKey, secondRedisHit);
        return { ...secondRedisHit, cacheStatus: "redis-hit" };
      }

      const startedAt = Date.now();
      const generated = await generateInterviewQuestionAudio({
        questionText: question.text,
        voice,
      });
      const cached = { ...generated, generatedAt: Date.now() };
      putAudioCache(cacheKey, cached);
      await setRedisQuestionAudio(cacheKey, cached);
      logInterviewTiming("question_audio_ready", {
        interviewId: String(interviewId),
        questionId: question.id,
        sequence: question.sequence,
        model: generated.model,
        usedFallback: Boolean(generated.usedFallback),
        ttsMs: Number(generated.durationMs || Date.now() - startedAt),
      });
      return { ...cached, cacheStatus: lock.distributed ? "generated-distributed" : "generated" };
    } finally {
      await lock.release();
    }
  });
};

const prewarmQuestionAudio = ({ interviewId, question, voice }) => {
  if (!question?.id || !question?.text) return;
  generateCachedQuestionAudio({ interviewId, question, voice }).catch((error) => {
    console.warn("Smart Interview question-audio prewarm failed; on-demand retry remains available:", error?.message || error);
  });
};

export class InterviewEligibilityError extends Error {
  constructor(message = "Smart Interview is available to undergraduate learners and above.") {
    super(message);
    this.name = "InterviewEligibilityError";
    this.code = "INTERVIEW_NOT_ELIGIBLE";
  }
}

export class InterviewInsufficientFluxGemsError extends Error {
  constructor(required = INTERVIEW_COST) {
    super(`You need ${required} FluxGems to start a Smart Interview.`);
    this.name = "InterviewInsufficientFluxGemsError";
    this.code = "INSUFFICIENT_FLUXGEMS";
    this.required = required;
  }
}

export class InterviewStateError extends Error {
  constructor(message, code = "INTERVIEW_STATE_INVALID", status = 409) {
    super(message);
    this.name = "InterviewStateError";
    this.code = code;
    this.status = status;
  }
}

export const getInterviewEligibility = async (userId) => {
  const profile = await LearningProfile.findOne({ user: userId }).lean();
  const educationLevel = profile?.educationLevel || "";
  const eligible = INTERVIEW_ELIGIBLE_EDUCATION_LEVELS.has(educationLevel);

  return {
    eligible,
    educationLevel,
    reason: eligible
      ? "eligible"
      : "Smart Interview is available to undergraduate learners and above.",
    profile: profile
      ? {
          educationLevel,
          institutionName: profile.institutionName || "",
          program: profile.program || "",
          stream: profile.stream || "",
        }
      : null,
  };
};

const resumePayload = (file) =>
  file
    ? {
        fileName: String(file.originalname || "resume").slice(0, 220),
        mimeType: String(file.mimetype || "application/octet-stream").slice(0, 120),
        sizeBytes: Number(file.size || file.buffer?.length || 0),
        content: file.buffer,
      }
    : null;

export const beginSmartInterview = async ({ userId, input, resumeFile }) => {
  const existing = await InterviewSession.findOne({
    user: userId,
    startRequestId: input.startRequestId,
  }).lean();

  if (existing) {
    const user = await User.findById(userId).select("fluxGems").lean();
    return { interview: existing, balance: Number(user?.fluxGems || 0), duplicate: true };
  }

  const mongoSession = await mongoose.startSession();
  let interview;
  let updatedUser;

  try {
    await mongoSession.withTransaction(async () => {
      const profile = await LearningProfile.findOne({ user: userId }).session(mongoSession).lean();
      if (!profile || !INTERVIEW_ELIGIBLE_EDUCATION_LEVELS.has(profile.educationLevel)) {
        throw new InterviewEligibilityError();
      }

      updatedUser = await User.findOneAndUpdate(
        { _id: userId, isActive: true, fluxGems: { $gte: INTERVIEW_COST } },
        { $inc: { fluxGems: -INTERVIEW_COST } },
        { returnDocument: "after", session: mongoSession },
      );

      if (!updatedUser) throw new InterviewInsufficientFluxGemsError();

      [interview] = await InterviewSession.create(
        [
          {
            user: userId,
            startRequestId: input.startRequestId,
            targetRole: input.targetRole,
            experienceLevel: input.experienceLevel,
            interviewType: input.interviewType,
            cost: INTERVIEW_COST,
            status: "in_progress",
            phase: "ready",
            maxQuestions: INTERVIEW_QUESTION_COUNT,
            interviewer: {
              name: "Astra",
              voice: String(process.env.INTERVIEW_TTS_VOICE || "Kore").trim() || "Kore",
            },
            useLearnerProfile: input.useLearnerProfile !== false,
            profileSnapshot: input.useLearnerProfile !== false
              ? {
                  educationLevel: profile.educationLevel || "",
                  institutionName: profile.institutionName || "",
                  program: profile.program || "",
                  stream: profile.stream || "",
                }
              : {},
            readinessSnapshot: {
              microphoneVerified: true,
              testRecordingConfirmed: true,
              networkVerified: true,
              averageLatencyMs: input.averageLatencyMs,
              jitterMs: input.jitterMs,
              uploadMs: input.uploadMs,
            },
            resume: resumePayload(resumeFile),
            startedAt: new Date(),
            lastActivityAt: new Date(),
          },
        ],
        { session: mongoSession },
      );

      await FluxGemTransaction.create(
        [
          {
            user: userId,
            type: "spend",
            amount: -INTERVIEW_COST,
            balanceAfter: updatedUser.fluxGems,
            reason: "smart_interview",
            interviewSession: interview._id,
            metadata: {
              targetRole: input.targetRole,
              interviewType: input.interviewType,
              experienceLevel: input.experienceLevel,
              useLearnerProfile: input.useLearnerProfile !== false,
            },
          },
        ],
        { session: mongoSession },
      );
    });

    return {
      interview: interview.toObject(),
      balance: Number(updatedUser.fluxGems || 0),
      duplicate: false,
    };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await InterviewSession.findOne({
        user: userId,
        startRequestId: input.startRequestId,
      }).lean();
      if (duplicate) {
        const user = await User.findById(userId).select("fluxGems").lean();
        return { interview: duplicate, balance: Number(user?.fluxGems || 0), duplicate: true };
      }
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
};

const buildQuestion = ({ question, sequence, model, usedFallback }) => ({
  id: randomUUID(),
  sequence,
  text: question.text,
  category: question.category,
  difficulty: question.difficulty,
  rationale: question.rationale,
  generatedByModel: model,
  usedFallback: Boolean(usedFallback),
  askedAt: new Date(),
});

export const initializeSmartInterview = async ({ userId, interviewId }) =>
  singleFlight(initializeFlights, `${userId}:${interviewId}`, async () => {
    let interview = await InterviewSession.findOne({ _id: interviewId, user: userId })
      .select("+resume.content");

    if (!interview) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
    if (interview.status === "completed" || interview.phase === "report_ready") {
      return { interview: interview.toObject(), initialized: false };
    }
    if (interview.currentQuestion?.id) {
      return { interview: interview.toObject(), initialized: false };
    }
    if (interview.phase !== "ready") {
      throw new InterviewStateError("This interview is not ready to initialize.");
    }

    const lock = await acquireDistributedLock(
      `interview:init:${userId}:${interviewId}`,
      150000,
    );

    if (!lock.acquired) {
      const settled = await waitForCondition(
        async () => {
          const latest = await InterviewSession.findOne({
            _id: interviewId,
            user: userId,
          }).select("+resume.content");
          if (!latest) return { missing: true };
          if (
            latest.currentQuestion?.id ||
            latest.status === "completed" ||
            latest.phase !== "ready"
          ) {
            return { interview: latest };
          }
          return null;
        },
        { timeoutMs: 25000, intervalMs: 350 },
      );

      if (settled?.missing) {
        throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
      }
      if (settled?.interview) {
        return { interview: settled.interview.toObject(), initialized: false };
      }

      throw new InterviewStateError(
        "Astra is already preparing this interview. Try again in a moment.",
        "INTERVIEW_INITIALIZATION_BUSY",
        409,
      );
    }

    try {
      // Re-read after acquiring the distributed lease. Another instance may
      // have completed initialization between the first read and this lock.
      interview = await InterviewSession.findOne({ _id: interviewId, user: userId })
        .select("+resume.content");
      if (!interview) {
        throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
      }
      if (
        interview.currentQuestion?.id ||
        interview.status === "completed" ||
        interview.phase === "report_ready"
      ) {
        return { interview: interview.toObject(), initialized: false };
      }
      if (interview.phase !== "ready") {
        throw new InterviewStateError("This interview is not ready to initialize.");
      }

      const generated = await generateFirstInterviewQuestion(interview);
      const currentQuestion = buildQuestion({
        question: generated.question,
        sequence: 1,
        model: generated.model,
        usedFallback: generated.usedFallback,
      });

      const updated = await InterviewSession.findOneAndUpdate(
        { _id: interviewId, user: userId, phase: "ready", questionCount: 0, currentQuestion: null },
        {
          $set: {
            phase: "interviewing",
            resumeContext: generated.resumeContext,
            currentQuestion,
            questionCount: 1,
            lastActivityAt: new Date(),
          },
        },
        { returnDocument: "after" },
      ).select("+resume.content");

      if (!updated) {
        interview = await InterviewSession.findOne({ _id: interviewId, user: userId }).select("+resume.content");
        if (!interview) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
        return { interview: interview.toObject(), initialized: false };
      }

      prewarmQuestionAudio({
        interviewId: updated._id,
        question: updated.currentQuestion,
        voice: updated.interviewer?.voice || "Kore",
      });

      return { interview: updated.toObject(), initialized: true };
    } finally {
      await lock.release();
    }
  });

const findProcessedTurn = (interview, { submissionId, questionId }) =>
  (interview.transcript || []).find(
    (turn) => turn.submissionId === submissionId || turn.question?.id === questionId,
  );

export const submitSmartInterviewAnswer = async ({
  userId,
  interviewId,
  input,
  answerFile,
}) =>
  singleFlight(answerFlights, `${userId}:${interviewId}:${input.questionId}`, async () => {
    let interview = await InterviewSession.findOne({ _id: interviewId, user: userId });
    if (!interview) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);

    const processed = findProcessedTurn(interview, input);
    if (processed) {
      return {
        interview: interview.toObject(),
        turn: processed,
        duplicate: true,
        completed: interview.status === "completed",
      };
    }

    if (interview.status !== "in_progress" || interview.phase !== "interviewing") {
      throw new InterviewStateError("This interview is not accepting answers.", "INTERVIEW_NOT_ACTIVE");
    }
    if (!interview.currentQuestion?.id || interview.currentQuestion.id !== input.questionId) {
      throw new InterviewStateError(
        "That question is no longer active. Reload the interview to continue.",
        "INTERVIEW_QUESTION_STALE",
      );
    }

    const lock = await acquireDistributedLock(
      `interview:answer:${userId}:${interviewId}:${input.questionId}`,
      150000,
    );

    if (!lock.acquired) {
      const settled = await waitForCondition(
        async () => {
          const latest = await InterviewSession.findOne({ _id: interviewId, user: userId });
          if (!latest) return { missing: true };
          const existingTurn = findProcessedTurn(latest, input);
          if (existingTurn) return { interview: latest, turn: existingTurn };
          if (
            latest.status !== "in_progress" ||
            latest.phase !== "interviewing" ||
            latest.currentQuestion?.id !== input.questionId
          ) {
            return { interview: latest, stale: true };
          }
          return null;
        },
        { timeoutMs: 30000, intervalMs: 400 },
      );

      if (settled?.missing) {
        throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
      }
      if (settled?.turn) {
        return {
          interview: settled.interview.toObject(),
          turn: settled.turn,
          duplicate: true,
          completed: settled.interview.status === "completed",
        };
      }
      if (settled?.stale) {
        throw new InterviewStateError(
          "That question is no longer active. Reload the interview to continue.",
          "INTERVIEW_QUESTION_STALE",
          409,
        );
      }
      throw new InterviewStateError(
        "Astra is already processing this answer. Keep this page open for a moment.",
        "INTERVIEW_ANSWER_BUSY",
        409,
      );
    }

    try {
      // Re-read after the distributed lease so only one instance spends a
      // Gemini evaluation on this question. Mongo's atomic commit remains the
      // final idempotency guard.
      interview = await InterviewSession.findOne({ _id: interviewId, user: userId });
      if (!interview) {
        throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
      }
      const alreadyProcessed = findProcessedTurn(interview, input);
      if (alreadyProcessed) {
        return {
          interview: interview.toObject(),
          turn: alreadyProcessed,
          duplicate: true,
          completed: interview.status === "completed",
        };
      }
      if (
        interview.status !== "in_progress" ||
        interview.phase !== "interviewing" ||
        interview.currentQuestion?.id !== input.questionId
      ) {
        throw new InterviewStateError(
          "That question is no longer active. Reload the interview to continue.",
          "INTERVIEW_QUESTION_STALE",
          409,
        );
      }

      const turnStartedAt = Date.now();
      const evaluationStartedAt = Date.now();
      const evaluated = await evaluateInterviewAnswer({
        interview,
        answerFile,
        completionReason: input.completionReason,
      });
      const evaluationMs = Date.now() - evaluationStartedAt;

      const currentQuestion = { ...interview.currentQuestion };
      const turn = {
        submissionId: input.submissionId,
        questionNumber: Number(currentQuestion.sequence || interview.questionCount || 1),
        question: currentQuestion,
        answerTranscript: evaluated.transcript,
        answerDurationMs: input.durationMs,
        completionReason: input.completionReason,
        evaluation: evaluated.evaluation,
        evaluatedByModel: evaluated.model,
        usedFallback: Boolean(evaluated.usedFallback),
        submittedAt: new Date(),
      };

      const now = new Date();
      if (evaluated.shouldComplete) {
        await stampInterviewCompletionDay({ userId, interview, completedAt: now });
        let completedInterview = await InterviewSession.findOneAndUpdate(
          {
            _id: interviewId,
            user: userId,
            status: "in_progress",
            phase: "interviewing",
            "currentQuestion.id": input.questionId,
            "transcript.question.id": { $ne: input.questionId },
          },
          {
            $push: { transcript: turn },
            $set: {
              currentQuestion: null,
              phase: "report_generating",
              status: "completed",
              completedAt: now,
              lastActivityAt: now,
              completionTimezone: interview.completionTimezone,
              completionLocalDay: interview.completionLocalDay,
            },
          },
          { returnDocument: "after" },
        );

        if (!completedInterview) {
          const latest = await InterviewSession.findOne({ _id: interviewId, user: userId });
          if (!latest) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
          const existingTurn = findProcessedTurn(latest, input);
          if (existingTurn) {
            return {
              interview: latest.toObject(),
              turn: existingTurn,
              duplicate: true,
              completed: latest.status === "completed",
            };
          }
          throw new InterviewStateError(
            "That question is no longer active. Reload the interview to continue.",
            "INTERVIEW_QUESTION_STALE",
          );
        }

        let progression = null;
        try {
          progression = await syncSmartInterviewProgression({ userId, interviewId });
          completedInterview.progressionReward = {
            xpEarned: progression.xpEarned,
            interviewCompletionXp: progression.interviewCompletionXp,
            achievementXpEarned: progression.achievementXpEarned,
            totalXp: progression.totalXp,
            levelFluxGemsEarned: Number(progression.levelFluxGemsEarned || 0),
            fluxGemsBalance: Number(progression.fluxGemsBalance || 0),
            antiFarmingApplied: progression.antiFarmingApplied,
            levelUp: progression.levelUp,
            processedAt: new Date(),
          };
          await completedInterview.save();
          queueLeaderboardRefresh(userId);
        } catch (error) {
          console.error("Smart Interview progression sync failed; it will be backfilled from progression overview:", error);
        }

        queueSmartInterviewReport({ userId, interviewId });
        logInterviewTiming("answer_processed_complete", {
          interviewId: String(completedInterview._id),
          questionId: input.questionId,
          evaluationMs,
          totalMs: Date.now() - turnStartedAt,
        });
        return {
          interview: completedInterview.toObject(),
          turn,
          duplicate: false,
          completed: true,
          progression,
        };
      }

      const nextSequence = Number(currentQuestion.sequence || interview.questionCount || 1) + 1;
      const nextQuestion = buildQuestion({
        question: evaluated.nextQuestion,
        sequence: nextSequence,
        model: evaluated.model,
        usedFallback: evaluated.usedFallback,
      });

      const updatedInterview = await InterviewSession.findOneAndUpdate(
        {
          _id: interviewId,
          user: userId,
          status: "in_progress",
          phase: "interviewing",
          "currentQuestion.id": input.questionId,
          "transcript.question.id": { $ne: input.questionId },
        },
        {
          $push: { transcript: turn },
          $set: {
            currentQuestion: nextQuestion,
            questionCount: Math.max(Number(interview.questionCount || 0), nextSequence),
            lastActivityAt: now,
          },
        },
        { returnDocument: "after" },
      );

      if (!updatedInterview) {
        const latest = await InterviewSession.findOne({ _id: interviewId, user: userId });
        if (!latest) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
        const existingTurn = findProcessedTurn(latest, input);
        if (existingTurn) {
          return {
            interview: latest.toObject(),
            turn: existingTurn,
            duplicate: true,
            completed: latest.status === "completed",
          };
        }
        throw new InterviewStateError(
          "That question is no longer active. Reload the interview to continue.",
          "INTERVIEW_QUESTION_STALE",
        );
      }

      prewarmQuestionAudio({
        interviewId: updatedInterview._id,
        question: nextQuestion,
        voice: updatedInterview.interviewer?.voice || "Kore",
      });
      logInterviewTiming("answer_processed", {
        interviewId: String(updatedInterview._id),
        questionId: input.questionId,
        nextQuestionId: nextQuestion.id,
        sequence: nextSequence,
        evaluationMs,
        totalMs: Date.now() - turnStartedAt,
      });

      return { interview: updatedInterview.toObject(), turn, duplicate: false, completed: false };
    } finally {
      await lock.release();
    }
  });

export const getSmartInterviewQuestionAudio = async ({ userId, interviewId, questionId }) => {
  const interview = await InterviewSession.findOne({ _id: interviewId, user: userId }).lean();
  if (!interview) throw new InterviewStateError("Interview not found.", "INTERVIEW_NOT_FOUND", 404);
  if (!interview.currentQuestion?.id || interview.currentQuestion.id !== questionId) {
    throw new InterviewStateError("That interview question is no longer active.", "INTERVIEW_QUESTION_STALE");
  }

  return generateCachedQuestionAudio({
    interviewId,
    question: interview.currentQuestion,
    voice: interview.interviewer?.voice || "Kore",
  });
};
