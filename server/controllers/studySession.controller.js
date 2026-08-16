import mongoose from "mongoose";

import LearningProfile from "../models/LearningProfile.js";
import StudySession from "../models/StudySession.js";
import {
  beginPaidStudyGeneration,
  InsufficientFluxGemsError,
  refundFailedStudyGeneration,
} from "../services/fluxGem.service.js";
import { generateLearningSession } from "../services/gemini.service.js";
import { validateStudyGenerationInput } from "../utils/studySessionValidation.js";

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
  sourceMode: studySession.sourceMode,
  topic: studySession.topic || "",
  sourceFile: studySession.sourceFile || null,
  academicContext:
    studySession.academicContext || null,
  detailLevel: studySession.detailLevel,
  difficulty: studySession.difficulty,
  quizSize: Number(studySession.quizSize || 0),
  cost: studySession.cost,
  status: studySession.status,
  modelUsed: studySession.modelUsed || "",
  fallbackUsed: Boolean(studySession.fallbackUsed),
  output: sanitizeOutput(studySession.output, includeQuizAnswers),
  quizProgress: serializeQuizProgress(studySession),
  chargedAt: studySession.chargedAt,
  refundedAt: studySession.refundedAt,
  completedAt: studySession.completedAt,
  createdAt: studySession.createdAt,
  updatedAt: studySession.updatedAt,
});

const serializeStudySessionSummary = (studySession) => {
  const generationType = getGenerationType(studySession);

  return {
    id: studySession._id,
    generationType,
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
    modelUsed: studySession.modelUsed || "",
    fallbackUsed: Boolean(studySession.fallbackUsed),
    hasNotes: Boolean(studySession.output?.notes),
    hasQuiz: Boolean(studySession.output?.quiz?.questions?.length),
    quizProgress: serializeQuizProgress(studySession),
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

  try {
    const generation = await generateLearningSession({
      profile: effectiveAcademicContext,
      generationType,
      ...generationSettings,
      sourceFile:
        generationSettings.sourceMode === "source" ? req.file : null,
    });

    const completedSession = await StudySession.findOneAndUpdate(
      {
        _id: studySessionId,
        user: req.user._id,
        status: "generating",
      },
      {
        $set: {
          status: "completed",
          modelUsed: generation.modelUsed,
          fallbackUsed: generation.fallbackUsed,
          output: generation.output,
          completedAt: new Date(),
          failureCode: "",
          failureMessage: "",
        },
      },
      { new: true },
    );

    if (!completedSession) {
      throw new Error(
        "The generated learning content could not be saved.",
      );
    }

    return res.status(201).json({
      success: true,
      message: generation.fallbackUsed
        ? "Learning content generated using the fallback Gemini model."
        : "Learning content generated successfully.",
      data: {
        studySession: serializeStudySession(completedSession),
        fluxGems: {
          charged: generationCost,
          balance: reservation.balance,
        },
      },
    });
  } catch (generationError) {
    let refundResult = {
      refunded: false,
      balance: reservation.balance,
    };

    try {
      refundResult = await refundFailedStudyGeneration({
        userId: req.user._id,
        studySessionId,
        cost: generationCost,
        failureCode:
          generationError.code || "AI_GENERATION_FAILED",
        failureMessage:
          generationError.message || "AI generation failed.",
      });
    } catch (refundError) {
      console.error(
        "CRITICAL: FluxGem refund failed after AI generation error:",
        refundError,
      );
    }

    return res.status(503).json({
      success: false,
      code:
        generationError.code || "AI_GENERATION_FAILED",
      message: refundResult.refunded
        ? `The AI generation failed, so your ${generationCost} FluxGems were returned. Please try again.`
        : "The AI generation failed. Please try again.",
      data: {
        refunded: refundResult.refunded,
        balance: refundResult.balance,
      },
    });
  }
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

    const filter = {
      user: req.user._id,
      status: "completed",
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
        "generationType sourceMode topic sourceFile academicContext detailLevel difficulty quizSize cost modelUsed fallbackUsed output.sessionTitle output.shortDescription output.notes output.quiz quizProgress completedAt createdAt",
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
    const now = new Date();
    const previousAttempts = Number(studySession.quizProgress?.attempts || 0);
    const previousBest = Number(
      studySession.quizProgress?.bestPercentage || 0,
    );

    studySession.quizProgress = {
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

    await studySession.save();

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
