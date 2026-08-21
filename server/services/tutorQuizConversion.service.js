import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";

import FluxGemTransaction from "../models/FluxGemTransaction.js";
import StudySession from "../models/StudySession.js";
import TutorMessage from "../models/TutorMessage.js";
import User from "../models/User.js";

const DEFAULT_PRIMARY_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_HTTP_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);
const MIN_QUIZ_QUESTIONS = 2;
const MAX_QUIZ_QUESTIONS = 30;

export const TUTOR_QUIZ_CONVERSION_COST = Math.max(
  Number(process.env.TUTOR_QUIZ_CONVERSION_COST || 25),
  1,
);

const CONVERSION_TIMEOUT_MS = Math.max(
  Number(process.env.TUTOR_QUIZ_CONVERSION_TIMEOUT_MS || 60000),
  5000,
);

const quizProperty = {
  type: "object",
  properties: {
    title: { type: "string" },
    instructions: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctOptionIndex: { type: "integer" },
          explanation: { type: "string" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
        },
        required: [
          "question",
          "options",
          "correctOptionIndex",
          "explanation",
          "difficulty",
        ],
      },
    },
  },
  required: ["title", "instructions", "questions"],
};

const responseSchema = {
  type: "object",
  properties: {
    sessionTitle: { type: "string" },
    shortDescription: { type: "string" },
    estimatedStudyMinutes: { type: "integer" },
    quiz: quizProperty,
  },
  required: [
    "sessionTitle",
    "shortDescription",
    "estimatedStudyMinutes",
    "quiz",
  ],
};

export class TutorQuizConversionError extends Error {
  constructor(message, code = "TUTOR_QUIZ_CONVERSION_FAILED", status = 400) {
    super(message);
    this.name = "TutorQuizConversionError";
    this.code = code;
    this.status = status;
  }
}

export class TutorQuizConversionInsufficientGemsError extends Error {
  constructor(required = TUTOR_QUIZ_CONVERSION_COST) {
    super(`You need ${required} FluxGems to save this Tutor quiz to Study Library.`);
    this.name = "TutorQuizConversionInsufficientGemsError";
    this.code = "TUTOR_QUIZ_CONVERSION_INSUFFICIENT_FLUXGEMS";
    this.required = required;
  }
}

const runWithTimeout = (operation, timeoutMs, model) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error(
        `${model} did not finish the Tutor quiz conversion within ${Math.round(timeoutMs / 1000)} seconds.`,
      );
      error.code = "GEMINI_MODEL_TIMEOUT";
      error.status = 504;
      reject(error);
    }, timeoutMs);

    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
  });

const getApiClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new TutorQuizConversionError(
      "Gemini is not configured for Tutor quiz conversion.",
      "GEMINI_NOT_CONFIGURED",
      503,
    );
  }
  return new GoogleGenAI({ apiKey });
};

const normalizeQuestionText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[`*_#>]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const looksLikeTutorQuiz = (content) => {
  const text = String(content || "").trim();
  if (text.length < 120) return false;

  const quizWord = /\bquiz\b|\bassessment\b|\bmcq\b/i.test(text);
  const questionMarkers = (
    text.match(/(?:^|\n)\s*(?:[-*]\s*)?(?:#{1,6}\s*)?(?:question\s*)?\d{1,2}(?:[.)\-:]|\s+-)?\s+/gim) || []
  ).length;
  const optionMarkers = (
    text.match(/(?:^|\n)\s*(?:[-*]\s*)?[A-D][.)\-:]\s+/gm) || []
  ).length;
  const answerMarkers = (
    text.match(/\b(?:answer|correct answer)\s*[:\-]/gi) || []
  ).length;

  return (
    (questionMarkers >= 2 && optionMarkers >= 8) ||
    (quizWord && questionMarkers >= 2) ||
    (quizWord && optionMarkers >= 8 && answerMarkers >= 1)
  );
};

const validateQuizOutput = (output) => {
  const questions = output?.quiz?.questions;
  if (
    !Array.isArray(questions) ||
    questions.length < MIN_QUIZ_QUESTIONS ||
    questions.length > MAX_QUIZ_QUESTIONS
  ) {
    throw new TutorQuizConversionError(
      `Tutor conversion needs a complete quiz with ${MIN_QUIZ_QUESTIONS}-${MAX_QUIZ_QUESTIONS} multiple-choice questions.`,
      "TUTOR_QUIZ_NOT_FOUND",
      400,
    );
  }

  const seen = new Set();
  for (const question of questions) {
    const normalizedQuestion = normalizeQuestionText(question?.question);
    if (!normalizedQuestion || seen.has(normalizedQuestion)) {
      throw new TutorQuizConversionError(
        "The Tutor quiz contains missing or duplicate questions.",
        "TUTOR_QUIZ_INVALID",
        422,
      );
    }
    seen.add(normalizedQuestion);

    const normalizedOptions = Array.isArray(question?.options)
      ? question.options.map((option) => normalizeQuestionText(option))
      : [];

    if (
      !Array.isArray(question?.options) ||
      question.options.length !== 4 ||
      question.options.some((option) => !String(option || "").trim()) ||
      new Set(normalizedOptions).size !== 4 ||
      !Number.isInteger(question?.correctOptionIndex) ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex > 3
    ) {
      throw new TutorQuizConversionError(
        "The Tutor quiz could not be converted because one or more questions are incomplete.",
        "TUTOR_QUIZ_INVALID",
        422,
      );
    }
  }

  return {
    sessionTitle: String(output.sessionTitle || output.quiz.title || "Tutor quiz")
      .trim()
      .slice(0, 180),
    shortDescription: String(
      output.shortDescription || "Quiz saved from an AI Tutor conversation.",
    )
      .trim()
      .slice(0, 500),
    estimatedStudyMinutes: Math.round(
      Math.min(
        Math.max(Number(output.estimatedStudyMinutes || questions.length * 2), 1),
        180,
      ),
    ),
    quiz: {
      title: String(output.quiz.title || output.sessionTitle || "Tutor quiz")
        .trim()
        .slice(0, 180),
      instructions: String(
        output.quiz.instructions ||
          "Choose one answer for each question, then submit your quiz.",
      )
        .trim()
        .slice(0, 600),
      questions: questions.map((question) => ({
        question: String(question.question || "").trim().slice(0, 1000),
        options: question.options.map((option) =>
          String(option || "").trim().slice(0, 500),
        ),
        correctOptionIndex: Number(question.correctOptionIndex),
        explanation: String(question.explanation || "")
          .trim()
          .slice(0, 1600),
        difficulty: ["easy", "medium", "hard"].includes(question.difficulty)
          ? question.difficulty
          : "medium",
      })),
    },
  };
};

const buildExtractionPrompt = ({ assistantContent, academicContext }) => `
Convert the multiple-choice quiz contained in the AI Tutor message below into a StudyFluxAI quiz-only Study Library artifact.

IMPORTANT RULES
1. Extract the quiz that is actually present in the Tutor message. Do not create an unrelated new quiz.
2. Keep every visible question and its four answer options faithful to the Tutor message. Minor wording cleanup is allowed only for formatting clarity.
3. Every question must have exactly four distinct answer options.
4. If the Tutor message includes an answer key, preserve it. If it presents complete questions/options but omits an answer key, independently solve each question so correctOptionIndex is accurate.
5. correctOptionIndex is zero-based: 0, 1, 2, or 3.
6. Give each question a concise explanation of why the correct option is right.
7. Use a useful Study Library title and one-sentence description.
8. Return only the structured JSON response requested by the schema.
9. Do not invent extra questions just to reach a preferred count. Preserve the actual quiz count, between ${MIN_QUIZ_QUESTIONS} and ${MAX_QUIZ_QUESTIONS} questions.

LEARNER CONTEXT
Education level: ${academicContext?.educationLevel || ""}
Program: ${academicContext?.program || ""}
Stream: ${academicContext?.stream || ""}

AI TUTOR MESSAGE
---
${assistantContent}
---
`.trim();

const shouldUseFallback = (error) => {
  if (error?.code === "GEMINI_INVALID_OUTPUT") return true;
  const status = Number(error?.status || error?.statusCode || 0);
  return FALLBACK_HTTP_STATUSES.has(status);
};

const extractWithModel = async ({ ai, model, prompt }) => {
  const response = await runWithTimeout(
    () =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
          temperature: 0.15,
        },
      }),
    CONVERSION_TIMEOUT_MS,
    model,
  );

  if (!response?.text) {
    const error = new Error("Gemini returned an empty Tutor quiz conversion.");
    error.code = "GEMINI_INVALID_OUTPUT";
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    const error = new Error("Gemini returned malformed Tutor quiz conversion data.");
    error.code = "GEMINI_INVALID_OUTPUT";
    throw error;
  }

  return validateQuizOutput(parsed);
};

export const extractTutorQuiz = async ({ assistantContent, academicContext }) => {
  if (!looksLikeTutorQuiz(assistantContent)) {
    throw new TutorQuizConversionError(
      "I couldn't find a complete multiple-choice quiz in that Tutor reply.",
      "TUTOR_QUIZ_NOT_FOUND",
      400,
    );
  }

  const ai = getApiClient();
  const primaryModel = String(
    process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL,
  ).trim();
  const fallbackModel = String(
    process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ).trim();
  const prompt = buildExtractionPrompt({ assistantContent, academicContext });
  const startedAt = Date.now();

  try {
    const output = await extractWithModel({ ai, model: primaryModel, prompt });
    return {
      output,
      modelUsed: primaryModel,
      fallbackUsed: false,
      durationMs: Date.now() - startedAt,
    };
  } catch (primaryError) {
    if (
      !fallbackModel ||
      fallbackModel === primaryModel ||
      !shouldUseFallback(primaryError)
    ) {
      throw new TutorQuizConversionError(
        primaryError?.message || "The Tutor quiz could not be converted.",
        primaryError?.code || "TUTOR_QUIZ_CONVERSION_FAILED",
        Number(primaryError?.status || 503),
      );
    }

    console.warn(
      `Tutor quiz conversion primary model ${primaryModel} failed; trying ${fallbackModel}: ${primaryError.message}`,
    );

    try {
      const output = await extractWithModel({ ai, model: fallbackModel, prompt });
      return {
        output,
        modelUsed: fallbackModel,
        fallbackUsed: true,
        durationMs: Date.now() - startedAt,
      };
    } catch (fallbackError) {
      throw new TutorQuizConversionError(
        fallbackError?.message || "The Tutor quiz could not be converted.",
        "TUTOR_QUIZ_CONVERSION_ALL_MODELS_FAILED",
        Number(fallbackError?.status || 503),
      );
    }
  }
};

export const getTutorQuizProgressionSource = ({ extractedQuiz, contextStudySession }) => {
  const sourceQuestions = contextStudySession?.output?.quiz?.questions || [];
  const extractedQuestions = extractedQuiz?.quiz?.questions || [];
  if (sourceQuestions.length === 0 || extractedQuestions.length === 0) {
    return { progressionSource: null, sourceKind: "tutor_generated" };
  }

  const sourceSet = new Set(
    sourceQuestions.map((question) => normalizeQuestionText(question?.question)),
  );
  const exactMatches = extractedQuestions.filter((question) =>
    sourceSet.has(normalizeQuestionText(question?.question)),
  ).length;
  const denominator = Math.min(sourceQuestions.length, extractedQuestions.length);
  const cloneRatio = denominator > 0 ? exactMatches / denominator : 0;
  const isDerivative = exactMatches >= 2 && cloneRatio >= 0.6;

  if (!isDerivative) {
    return { progressionSource: null, sourceKind: "tutor_generated" };
  }

  return {
    progressionSource:
      contextStudySession.quizProgressionSource || contextStudySession._id,
    sourceKind: "study_session_derivative",
  };
};

export const persistTutorQuizConversion = async ({
  userId,
  conversation,
  assistantMessage,
  extracted,
  contextStudySession = null,
}) => {
  const existing = await StudySession.findOne({
    user: userId,
    "tutorProvenance.assistantMessage": assistantMessage._id,
  }).lean();

  if (existing) {
    const currentUser = await User.findById(userId).select("fluxGems").lean();
    return {
      studySession: existing,
      balance: Number(currentUser?.fluxGems || 0),
      alreadyConverted: true,
    };
  }

  const { progressionSource, sourceKind } = getTutorQuizProgressionSource({
    extractedQuiz: extracted.output,
    contextStudySession,
  });
  const cost = TUTOR_QUIZ_CONVERSION_COST;
  const mongoSession = await mongoose.startSession();

  try {
    let createdStudySession = null;
    let updatedUser = null;

    await mongoSession.withTransaction(async () => {
      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          isActive: true,
          fluxGems: { $gte: cost },
        },
        { $inc: { fluxGems: -cost } },
        { returnDocument: "after", session: mongoSession },
      );

      if (!updatedUser) {
        throw new TutorQuizConversionInsufficientGemsError(cost);
      }

      const now = new Date();
      const questionCount = extracted.output.quiz.questions.length;

      [createdStudySession] = await StudySession.create(
        [
          {
            user: userId,
            generationType: "quiz",
            sourceMode: "tutor",
            origin: "ai_tutor",
            topic: extracted.output.sessionTitle,
            academicContext: conversation.academicContext || {},
            detailLevel: "balanced",
            difficulty: "profile",
            quizSize: questionCount,
            cost,
            status: "completed",
            generationStage: "completed",
            generationMetrics: {
              queuedAt: now,
              startedAt: now,
              primaryDurationMs: extracted.fallbackUsed ? 0 : extracted.durationMs,
              fallbackDurationMs: extracted.fallbackUsed ? extracted.durationMs : 0,
              totalDurationMs: extracted.durationMs,
              finishedAt: now,
            },
            chargedAt: now,
            modelUsed: extracted.modelUsed || "",
            fallbackUsed: Boolean(extracted.fallbackUsed),
            output: extracted.output,
            quizProgressionSource: progressionSource || null,
            tutorProvenance: {
              conversation: conversation._id,
              assistantMessage: assistantMessage._id,
              sourceStudySession: contextStudySession?._id || null,
              sourceKind,
              convertedAt: now,
            },
            completedAt: now,
          },
        ],
        { session: mongoSession },
      );

      await FluxGemTransaction.create(
        [
          {
            user: userId,
            type: "spend",
            amount: -cost,
            balanceAfter: updatedUser.fluxGems,
            reason: "ai_tutor_quiz_conversion",
            studySession: createdStudySession._id,
            tutorConversation: conversation._id,
            tutorMessage: assistantMessage._id,
            metadata: {
              conversionCost: cost,
              questionCount,
              sourceKind,
              progressionSource: progressionSource ? String(progressionSource) : "",
            },
          },
        ],
        { session: mongoSession },
      );

      await TutorMessage.findOneAndUpdate(
        {
          _id: assistantMessage._id,
          user: userId,
          conversation: conversation._id,
          role: "assistant",
        },
        {
          $set: {
            convertedStudySession: createdStudySession._id,
            convertedAt: now,
          },
        },
        { session: mongoSession },
      );
    });

    return {
      studySession: createdStudySession.toObject(),
      balance: Number(updatedUser.fluxGems || 0),
      alreadyConverted: false,
    };
  } catch (error) {
    if (error?.code === 11000) {
      const concurrent = await StudySession.findOne({
        user: userId,
        "tutorProvenance.assistantMessage": assistantMessage._id,
      }).lean();
      if (concurrent) {
        const currentUser = await User.findById(userId).select("fluxGems").lean();
        return {
          studySession: concurrent,
          balance: Number(currentUser?.fluxGems || 0),
          alreadyConverted: true,
        };
      }
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
};
