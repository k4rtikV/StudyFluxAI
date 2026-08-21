import { GoogleGenAI } from "@google/genai";

import { getNumberEnv } from "../config/env.js";

const DEFAULT_PRIMARY_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const FALLBACK_HTTP_STATUSES = new Set([
  404,
  408,
  429,
  500,
  502,
  503,
  504,
]);

const PRIMARY_TIMEOUT_MS = getNumberEnv("GEMINI_PRIMARY_TIMEOUT_MS", 60000);
const FALLBACK_TIMEOUT_MS = getNumberEnv("GEMINI_FALLBACK_TIMEOUT_MS", 60000);

const runWithTimeout = (operation, timeoutMs, model) =>
  new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;

      const error = new Error(
        `${model} did not respond within ${Math.round(timeoutMs / 1000)} seconds.`,
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

const notesProperty = {
  type: "object",
  properties: {
    overview: {
      type: "string",
      description: "A concise overview that introduces the topic and its importance.",
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          explanation: { type: "string" },
          keyPoints: {
            type: "array",
            items: { type: "string" },
          },
          example: { type: "string" },
        },
        required: [
          "heading",
          "explanation",
          "keyPoints",
          "example",
        ],
      },
    },
    keyTakeaways: {
      type: "array",
      items: { type: "string" },
    },
    revisionChecklist: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "overview",
    "sections",
    "keyTakeaways",
    "revisionChecklist",
  ],
};

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

const baseProperties = {
  sessionTitle: {
    type: "string",
    description: "Clear title for the generated learning content.",
  },
  shortDescription: {
    type: "string",
    description: "One short sentence describing what the learner will cover.",
  },
  estimatedStudyMinutes: {
    type: "integer",
    description: "Estimated minutes required to study or complete the generated content.",
  },
};

const responseSchemas = {
  combined: {
    type: "object",
    properties: {
      ...baseProperties,
      notes: notesProperty,
      quiz: quizProperty,
    },
    required: [
      "sessionTitle",
      "shortDescription",
      "estimatedStudyMinutes",
      "notes",
      "quiz",
    ],
  },
  notes: {
    type: "object",
    properties: {
      ...baseProperties,
      notes: notesProperty,
    },
    required: [
      "sessionTitle",
      "shortDescription",
      "estimatedStudyMinutes",
      "notes",
    ],
  },
  quiz: {
    type: "object",
    properties: {
      ...baseProperties,
      quiz: quizProperty,
    },
    required: [
      "sessionTitle",
      "shortDescription",
      "estimatedStudyMinutes",
      "quiz",
    ],
  },
};

class InvalidGeminiOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidGeminiOutputError";
    this.code = "GEMINI_INVALID_OUTPUT";
  }
}

const getApiClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    const error = new Error(
      "GEMINI_API_KEY is missing from the server environment.",
    );
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  return new GoogleGenAI({ apiKey });
};

const buildProfileContext = (profile) => {
  const parts = [
    `Education level: ${profile.educationLevel}`,
    `Institution: ${profile.institutionName}`,
  ];

  if (profile.institutionState) {
    parts.push(`State / UT: ${profile.institutionState}`);
  }

  if (profile.program) {
    parts.push(`Program: ${profile.program}`);
  }

  if (profile.stream) {
    parts.push(`Stream / specialization: ${profile.stream}`);
  }

  return parts.join("\n");
};

const detailGuidance = {
  concise:
    "Keep the notes compact and revision-focused. Prefer fewer sections with high-signal explanations.",
  balanced:
    "Use a balanced level of detail suitable for learning and later revision, with clear explanations and practical examples.",
  deep:
    "Give deeper conceptual coverage, more complete explanations, and richer examples while staying focused on the requested material.",
};

const buildSourceInstruction = ({ sourceMode, topic, textSource }) =>
  sourceMode === "topic"
    ? `Topic requested by the learner: ${topic}`
    : `The learner uploaded study material. Base the generated content on that source. Do not claim the source says something it does not support.${
        textSource
          ? `\n\nUploaded source text:\n---\n${textSource}\n---`
          : ""
      }`;

const buildPrompt = ({
  generationType,
  profile,
  sourceMode,
  topic,
  detailLevel,
  difficulty,
  quizSize,
  textSource,
}) => {
  const sourceInstruction = buildSourceInstruction({
    sourceMode,
    topic,
    textSource,
  });

  const common = `
LEARNER ACADEMIC CONTEXT
${buildProfileContext(profile)}

SOURCE
${sourceInstruction}

GENERAL RULES
1. Personalize terminology and depth to the learner's effective academic context without repeatedly mentioning that context.
2. Stay tightly grounded in the requested topic or uploaded source.
3. Keep the title and description clear enough to identify this item later in Study Library history.
4. Do not include markdown fences or commentary outside the requested structured response.
`.trim();

  if (generationType === "notes") {
    return `
Create standalone StudyFluxAI AI Notes. Generate notes only; do not create quiz questions.

${common}

NOTES SETTINGS
- Notes detail: ${detailLevel}
- Detail guidance: ${detailGuidance[detailLevel]}

NOTES RULES
1. Organize the notes from fundamentals to more advanced ideas.
2. Every notes section must include useful key points and a concrete example. If no natural example exists, use a short illustrative scenario rather than filler.
3. Include revision-friendly key takeaways and a practical revision checklist.
`.trim();
  }

  const effectiveDifficulty =
    difficulty === "profile"
      ? "Match the learner's education level and program context."
      : `Use ${difficulty} quiz difficulty while keeping wording appropriate for the learner context.`;

  if (generationType === "quiz") {
    return `
Create a standalone StudyFluxAI multiple-choice Quiz. Generate a quiz only; do not create study notes.

${common}

QUIZ SETTINGS
- Quiz size: exactly ${quizSize} questions
- Quiz difficulty: ${effectiveDifficulty}

QUIZ RULES
1. Create exactly ${quizSize} multiple-choice questions.
2. Every question must have exactly 4 distinct answer options.
3. correctOptionIndex must be zero-based and must be 0, 1, 2, or 3.
4. Each explanation must teach why the correct answer is right, not merely repeat it.
5. Avoid duplicate or trivially reworded questions.
6. Keep distractors plausible and within the same subject domain.
`.trim();
  }

  return `
Create a complete StudyFluxAI learning session consisting of structured study notes and a matching multiple-choice quiz.

${common}

SESSION SETTINGS
- Notes detail: ${detailLevel}
- Detail guidance: ${detailGuidance[detailLevel]}
- Quiz size: exactly ${quizSize} questions
- Quiz difficulty: ${effectiveDifficulty}

CONTENT RULES
1. Organize the notes from fundamentals to more advanced ideas.
2. Every notes section must include useful key points and a concrete example. If no natural example exists, use a short illustrative scenario rather than filler.
3. Create exactly ${quizSize} multiple-choice questions.
4. Every quiz question must have exactly 4 distinct answer options.
5. correctOptionIndex must be zero-based and must be 0, 1, 2, or 3.
6. Each explanation must teach why the correct answer is right, not merely repeat it.
7. Avoid duplicate or trivially reworded quiz questions.
`.trim();
};

const validateNotes = (output) => {
  if (
    !output.notes ||
    !Array.isArray(output.notes.sections) ||
    output.notes.sections.length === 0
  ) {
    throw new InvalidGeminiOutputError(
      "Gemini returned notes without usable sections.",
    );
  }
};

const validateQuiz = (output, quizSize) => {
  const questions = output.quiz?.questions;

  if (!Array.isArray(questions) || questions.length !== quizSize) {
    throw new InvalidGeminiOutputError(
      `Gemini returned ${questions?.length || 0} quiz questions instead of ${quizSize}.`,
    );
  }

  for (const question of questions) {
    if (
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      !Number.isInteger(question.correctOptionIndex) ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex > 3
    ) {
      throw new InvalidGeminiOutputError(
        "Gemini returned an invalid multiple-choice question.",
      );
    }
  }
};

const validateGeneratedSession = (
  output,
  { generationType, quizSize },
) => {
  if (!output || typeof output !== "object") {
    throw new InvalidGeminiOutputError(
      "Gemini returned an empty learning item.",
    );
  }

  if (["combined", "notes"].includes(generationType)) {
    validateNotes(output);
  }

  if (["combined", "quiz"].includes(generationType)) {
    validateQuiz(output, quizSize);
  }

  return output;
};

const generateWithModel = async ({
  ai,
  model,
  prompt,
  sourceFile,
  generationType,
  quizSize,
}) => {
  const contents = sourceFile?.buffer
    ? [
        {
          inlineData: {
            data: sourceFile.buffer.toString("base64"),
            mimeType: sourceFile.mimetype,
          },
        },
        { text: prompt },
      ]
    : prompt;

  const timeoutMs =
    model === String(
      process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
    ).trim()
      ? FALLBACK_TIMEOUT_MS
      : PRIMARY_TIMEOUT_MS;

  const response = await runWithTimeout(
    () =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchemas[generationType],
          temperature: generationType === "quiz" ? 0.35 : 0.45,
        },
      }),
    timeoutMs,
    model,
  );

  if (!response.text) {
    throw new InvalidGeminiOutputError(
      "Gemini returned an empty response.",
    );
  }

  let output;

  try {
    output = JSON.parse(response.text);
  } catch {
    throw new InvalidGeminiOutputError(
      "Gemini returned malformed structured output.",
    );
  }

  return validateGeneratedSession(output, {
    generationType,
    quizSize,
  });
};

const shouldUseFallback = (error) => {
  if (error?.code === "GEMINI_INVALID_OUTPUT") {
    return true;
  }

  const status = Number(error?.status || error?.statusCode || 0);
  return FALLBACK_HTTP_STATUSES.has(status);
};

const cleanModelError = (error) => {
  const status = Number(error?.status || error?.statusCode || 0);

  return {
    status,
    code: error?.code || "GEMINI_REQUEST_FAILED",
    message:
      error?.message ||
      "Gemini could not generate the requested learning content.",
  };
};

export const generateLearningSession = async ({
  profile,
  generationType = "combined",
  sourceMode,
  topic,
  detailLevel,
  difficulty,
  quizSize,
  sourceFile,
  onStageChange,
}) => {
  const ai = getApiClient();
  const primaryModel = String(
    process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL,
  ).trim();
  const fallbackModel = String(
    process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ).trim();

  const textSource =
    sourceMode === "source" &&
    sourceFile &&
    sourceFile.mimetype !== "application/pdf"
      ? sourceFile.buffer.toString("utf8")
      : "";

  const prompt = buildPrompt({
    generationType,
    profile,
    sourceMode,
    topic,
    detailLevel,
    difficulty,
    quizSize,
    textSource,
  });

  const primarySourceFile =
    sourceFile?.mimetype === "application/pdf" ? sourceFile : null;
  const totalStartedAt = Date.now();
  const timings = {
    primaryDurationMs: 0,
    fallbackDurationMs: 0,
    totalDurationMs: 0,
  };

  try {
    await onStageChange?.("primary", { model: primaryModel });
    const primaryStartedAt = Date.now();

    try {
      const output = await generateWithModel({
        ai,
        model: primaryModel,
        prompt,
        sourceFile: primarySourceFile,
        generationType,
        quizSize,
      });

      timings.primaryDurationMs = Date.now() - primaryStartedAt;
      timings.totalDurationMs = Date.now() - totalStartedAt;

      return {
        output,
        modelUsed: primaryModel,
        fallbackUsed: false,
        timings,
      };
    } catch (primaryError) {
      timings.primaryDurationMs = Date.now() - primaryStartedAt;

      if (
        !fallbackModel ||
        fallbackModel === primaryModel ||
        !shouldUseFallback(primaryError)
      ) {
        const cleaned = cleanModelError(primaryError);
        const error = new Error(cleaned.message);
        Object.assign(error, cleaned);
        timings.totalDurationMs = Date.now() - totalStartedAt;
        error.generationTimings = timings;
        throw error;
      }

      console.warn(
        `Gemini primary model ${primaryModel} failed; trying ${fallbackModel}: ${primaryError.message}`,
      );

      await onStageChange?.("fallback", {
        model: fallbackModel,
        primaryError: cleanModelError(primaryError),
      });

      const fallbackStartedAt = Date.now();

      try {
        const output = await generateWithModel({
          ai,
          model: fallbackModel,
          prompt,
          sourceFile: primarySourceFile,
          generationType,
          quizSize,
        });

        timings.fallbackDurationMs = Date.now() - fallbackStartedAt;
        timings.totalDurationMs = Date.now() - totalStartedAt;

        return {
          output,
          modelUsed: fallbackModel,
          fallbackUsed: true,
          timings,
        };
      } catch (fallbackError) {
        timings.fallbackDurationMs = Date.now() - fallbackStartedAt;
        timings.totalDurationMs = Date.now() - totalStartedAt;

        const cleaned = cleanModelError(fallbackError);
        const error = new Error(cleaned.message);
        error.code = "GEMINI_ALL_MODELS_FAILED";
        error.status = cleaned.status;
        error.primaryError = cleanModelError(primaryError);
        error.fallbackError = cleaned;
        error.generationTimings = timings;
        throw error;
      }
    }
  } catch (error) {
    if (!error.generationTimings) {
      timings.totalDurationMs = Date.now() - totalStartedAt;
      error.generationTimings = timings;
    }
    throw error;
  }
};