import mongoose from "mongoose";

import LearningProfile from "../models/LearningProfile.js";
import QuizAttempt from "../models/QuizAttempt.js";
import StudySession from "../models/StudySession.js";
import {
  beginPaidStudyGeneration,
  InsufficientFluxGemsError,
} from "../services/fluxGem.service.js";
import { queueLeaderboardRefresh } from "../services/leaderboard.service.js";
import { getProgressOverview } from "../services/progression.service.js";
import { enqueueStudyGeneration } from "../services/studyGenerationQueue.service.js";
import { validateStudyGenerationInput } from "../utils/studySessionValidation.js";
import { getLevelTransition } from "../utils/progressionRules.js";

const COSTS = {
  combined: Math.max(
    Number(process.env.GENERATION_FLUXGEM_COST || 50),
    0,
  ),
  notes: Math.max(
    Number(process.env.AI_NOTES_FLUXGEM_COST || 25),
    0,
  ),
  quiz: Math.max(
    Number(process.env.AI_QUIZ_FLUXGEM_COST || 25),
    0,
  ),
};

const getGenerationType = (studySession) =>
  studySession.generationType || "combined";

const getGenerationCost = (generationType) =>
  COSTS[generationType] ?? COSTS.combined;

const buildProfileSnapshot = (profile) => ({
  educationLevel: profile.educationLevel || "",
  institutionType: profile.institutionType || "",
  institutionState: profile.institutionState || "",
  institutionId: profile.institutionId || "",
  institutionCategory:
    profile.institutionCategory || "",
  institutionSector:
    profile.institutionSector || "",
  institutionKey: profile.institutionKey || "",
  institutionName: profile.institutionName || "",
  programKey: profile.programKey || "",
  program: profile.program || "",
  streamKey: profile.streamKey || "",
  stream: profile.stream || "",
});

const buildEffectiveAcademicContext = (profile, override) =>
  override ? { ...override } : buildProfileSnapshot(profile);

const sanitizeOutput = (output, includeQuizAnswers = false) => {
  if (!output) {
    return null;
  }

  const safeOutput = JSON.parse(JSON.stringify(output));

  if (!includeQuizAnswers && Array.isArray(safeOutput?.quiz?.questions)) {
    safeOutput.quiz.questions = safeOutput.quiz.questions.map((question) => {
      const {
        correctOptionIndex,
        explanation,
        ...safeQuestion
      } = question;

      return safeQuestion;
    });
  }

  return safeOutput;
};

const serializeQuizProgress = (studySession) => ({
  attempts: Number(studySession.quizProgress?.attempts || 0),
  latestAnswers: Array.isArray(studySession.quizProgress?.latestAnswers)
    ? studySession.quizProgress.latestAnswers
    : [],
  latestScore: Number(studySession.quizProgress?.latestScore || 0),
  totalQuestions: Number(studySession.quizProgress?.totalQuestions || 0),
  latestPercentage: Number(
    studySession.quizProgress?.latestPercentage || 0,
  ),
  bestPercentage: Number(studySession.quizProgress?.bestPercentage || 0),
  firstCompletedAt: studySession.quizProgress?.firstCompletedAt || null,
  lastCompletedAt: studySession.quizProgress?.lastCompletedAt || null,
});

const serializeStudySession = (
  studySession,
  { includeQuizAnswers = false } = {},
) => ({
  id: studySession._id,
  generationType: getGenerationType(studySession),
  origin: studySession.origin || "ai_generation",
  sourceMode: studySession.sourceMode,
  tutorProvenance: studySession.tutorProvenance || null,
  quizProgressionSource: studySession.quizProgressionSource || null,
  topic: studySession.topic || "",
  sourceFile: studySession.sourceFile || null,
  academicContext:
    studySession.academicContext || null,
  detailLevel: studySession.detailLevel,
  difficulty: studySession.difficulty,
  quizSize: Number(studySession.quizSize || 0),
  cost: studySession.cost,
  status: studySession.status,
  generationStage: studySession.generationStage ||
    (studySession.status === "completed" ? "completed" : studySession.status === "failed" ? "failed" : "queued"),
  generationMetrics: studySession.generationMetrics || null,
  modelUsed: studySession.modelUsed || "",
  fallbackUsed: Boolean(studySession.fallbackUsed),
  output: sanitizeOutput(studySession.output, includeQuizAnswers),
  quizProgress: serializeQuizProgress(studySession),
  chargedAt: studySession.chargedAt,
  refundedAt: studySession.refundedAt,
  failureCode: studySession.failureCode || "",
  failureMessage: studySession.failureMessage || "",
  completedAt: studySession.completedAt,
  createdAt: studySession.createdAt,
  updatedAt: studySession.updatedAt,
});

const serializeStudySessionSummary = (studySession) => {
  const generationType = getGenerationType(studySession);

  return {
    id: studySession._id,
    generationType,
    origin: studySession.origin || "ai_generation",
    tutorProvenance: studySession.tutorProvenance || null,
    title:
      studySession.output?.sessionTitle ||
      studySession.topic ||
      studySession.sourceFile?.fileName ||
      "Learning item",
    description: studySession.output?.shortDescription || "",
    sourceMode: studySession.sourceMode,
    sourceFile: studySession.sourceFile || null,
    academicContext: studySession.academicContext || null,
    detailLevel: studySession.detailLevel,
    difficulty: studySession.difficulty,
    quizSize: Number(studySession.quizSize || 0),
    cost: studySession.cost,
    status: studySession.status,
    generationStage: studySession.generationStage ||
      (studySession.status === "completed" ? "completed" : studySession.status === "failed" ? "failed" : "queued"),
    generationMetrics: studySession.generationMetrics || null,
    modelUsed: studySession.modelUsed || "",
    fallbackUsed: Boolean(studySession.fallbackUsed),
    hasNotes: Boolean(studySession.output?.notes),
    hasQuiz: Boolean(studySession.output?.quiz?.questions?.length),
    quizProgress: serializeQuizProgress(studySession),
    refundedAt: studySession.refundedAt || null,
    failureCode: studySession.failureCode || "",
    failureMessage: studySession.failureMessage || "",
    completedAt: studySession.completedAt,
    createdAt: studySession.createdAt,
  };
};

export const generateStudySession = async (req, res, next) => {
  const validation = validateStudyGenerationInput({
    body: req.body,
    file: req.file,
  });

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_GENERATION_INPUT",
      message: "Please correct the generation settings.",
      errors: validation.errors,
    });
  }

  if (!req.user.learningProfileCompleted) {
    return res.status(403).json({
      success: false,
      code: "LEARNING_PROFILE_REQUIRED",
      message: "Complete your learning profile before using AI generation.",
    });
  }

  let profile;

  try {
    profile = await LearningProfile.findOne({
      user: req.user._id,
    }).lean();
  } catch (error) {
    return next(error);
  }

  if (!profile) {
    return res.status(403).json({
      success: false,
      code: "LEARNING_PROFILE_REQUIRED",
      message: "Complete your learning profile before using AI generation.",
    });
  }

  const {
    generationType,
    academicContext: requestedAcademicContext,
    ...generationSettings
  } = validation.values;

  const effectiveAcademicContext = buildEffectiveAcademicContext(
    profile,
    requestedAcademicContext,
  );
  const generationCost = getGenerationCost(generationType);

  let reservation;

  try {
    reservation = await beginPaidStudyGeneration({
      userId: req.user._id,
      cost: generationCost,
      sessionData: {
        generationType,
        ...generationSettings,
        academicContext: effectiveAcademicContext,
        sourceFile:
          generationSettings.sourceMode === "source" && req.file
            ? {
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
              }
            : undefined,
      },
    });
  } catch (error) {
    if (error instanceof InsufficientFluxGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          required: generationCost,
          balance: Number(req.user.fluxGems || 0),
        },
      });
    }

    return next(error);
  }

  const studySessionId = reservation.studySession._id;
  const sourceFile =
    generationSettings.sourceMode === "source" && req.file
      ? {
          buffer: Buffer.from(req.file.buffer),
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
          size: req.file.size,
        }
      : null;

  enqueueStudyGeneration({
    studySessionId,
    userId: req.user._id,
    cost: generationCost,
    generationInput: {
      profile: effectiveAcademicContext,
      generationType,
      ...generationSettings,
      sourceFile,
    },
  });

  return res.status(202).json({
    success: true,
    message:
      "Generation started. You can leave this page while StudyFluxAI finishes in the background.",
    data: {
      studySession: serializeStudySession(reservation.studySession),
      fluxGems: {
        charged: generationCost,
        balance: reservation.balance,
        reserved: true,
      },
    },
  });
};

export const getStudySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    const studySession = await StudySession.findOne({
      _id: sessionId,
      user: req.user._id,
    }).lean();

    if (!studySession) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        studySession: serializeStudySession(studySession, {
          includeQuizAnswers:
            Number(studySession.quizProgress?.attempts || 0) > 0,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listStudySessions = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 30);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 30, 1),
      50,
    );

    const includePending = req.query.includePending === "true";
    const filter = {
      user: req.user._id,
      ...(includePending ? {} : { status: "completed" }),
    };

    if (["combined", "notes", "quiz"].includes(req.query.type)) {
      if (req.query.type === "combined") {
        filter.$or = [
          { generationType: "combined" },
          { generationType: { $exists: false } },
        ];
      } else {
        filter.generationType = req.query.type;
      }
    }

    const sessions = await StudySession.find(filter)
      .select(
        "generationType origin sourceMode topic sourceFile academicContext detailLevel difficulty quizSize cost status generationStage generationMetrics modelUsed fallbackUsed failureCode failureMessage refundedAt output.sessionTitle output.shortDescription output.notes output.quiz quizProgress quizProgressionSource tutorProvenance completedAt createdAt updatedAt",
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        studySessions: sessions.map(serializeStudySessionSummary),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const submitStudyQuiz = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { answers } = req.body;

    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    const studySession = await StudySession.findOne({
      _id: sessionId,
      user: req.user._id,
      status: "completed",
    });

    if (!studySession) {
      return res.status(404).json({
        success: false,
        code: "STUDY_SESSION_NOT_FOUND",
        message: "Learning item not found.",
      });
    }

    const questions = studySession.output?.quiz?.questions || [];

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        code: "QUIZ_NOT_AVAILABLE",
        message: "This generated item does not contain a quiz.",
      });
    }

    if (
      !Array.isArray(answers) ||
      answers.length !== questions.length
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ_ANSWERS",
        message: "Answer every quiz question before submitting.",
      });
    }

    const normalizedAnswers = answers.map((answer) => Number(answer));

    const invalidAnswer = normalizedAnswers.some((answer, index) => {
      const optionCount = questions[index]?.options?.length || 0;

      return (
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= optionCount
      );
    });

    if (invalidAnswer) {
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ_ANSWERS",
        message: "One or more quiz answers are invalid.",
      });
    }

    const score = questions.reduce(
      (total, question, index) =>
        total +
        (normalizedAnswers[index] === question.correctOptionIndex ? 1 : 0),
      0,
    );

    const totalQuestions = questions.length;
    const percentage = Number(
      ((score / totalQuestions) * 100).toFixed(2),
    );
    const beforeProgress = await getProgressOverview(req.user._id);
    const now = new Date();
    const previousAttempts = Number(studySession.quizProgress?.attempts || 0);
    const previousBest = Number(
      studySession.quizProgress?.bestPercentage || 0,
    );

    const nextQuizProgress = {
      attempts: previousAttempts + 1,
      latestAnswers: normalizedAnswers,
      latestScore: score,
      totalQuestions,
      latestPercentage: percentage,
      bestPercentage: Math.max(previousBest, percentage),
      firstCompletedAt:
        studySession.quizProgress?.firstCompletedAt || now,
      lastCompletedAt: now,
    };

    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        const updated = await StudySession.findOneAndUpdate(
          {
            _id: studySession._id,
            user: req.user._id,
            status: "completed",
          },
          { $set: { quizProgress: nextQuizProgress } },
          { new: true, session: mongoSession },
        );

        if (!updated) {
          throw new Error("The quiz could not be updated.");
        }

        await QuizAttempt.create(
          [
            {
              user: req.user._id,
              studySession: studySession._id,
              answers: normalizedAnswers,
              score,
              totalQuestions,
              percentage,
              attemptedAt: now,
            },
          ],
          { session: mongoSession },
        );
      });
    } finally {
      await mongoSession.endSession();
    }

    studySession.quizProgress = nextQuizProgress;

    const afterProgress = await getProgressOverview(req.user._id);
    const previousTotalXp = Number(beforeProgress?.stats?.totalXp || 0);
    const currentTotalXp = Number(afterProgress?.stats?.totalXp || 0);
    const xpEarned = Math.max(currentTotalXp - previousTotalXp, 0);
    const quizXpEarned = Math.max(
      Number(afterProgress?.stats?.quizXp || 0) -
        Number(beforeProgress?.stats?.quizXp || 0),
      0,
    );
    const achievementXpEarned = Math.max(
      Number(afterProgress?.stats?.achievementXp || 0) -
        Number(beforeProgress?.stats?.achievementXp || 0),
      0,
    );
    const levelUp = getLevelTransition(previousTotalXp, currentTotalXp);

    queueLeaderboardRefresh(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Quiz result saved.",
      data: {
        result: {
          score,
          totalQuestions,
          percentage,
        },
        quizProgress: serializeQuizProgress(studySession),
        progression: {
          ...afterProgress.progression,
          xpEarned,
          quizXpEarned,
          achievementXpEarned,
          levelUp,
        },
        review: questions.map((question) => ({
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation || "",
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
