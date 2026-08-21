import { safeErrorDetails } from "../utils/safeError.js";
import { GoogleGenAI } from "@google/genai";

import { getNumberEnv } from "../config/env.js";

const DEFAULT_PRIMARY_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const FALLBACK_HTTP_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

const PRIMARY_TIMEOUT_MS = getNumberEnv("GEMINI_PRIMARY_TIMEOUT_MS", 60000);
const FALLBACK_TIMEOUT_MS = getNumberEnv("GEMINI_FALLBACK_TIMEOUT_MS", 60000);

const httpError = (message, statusCode = 400, code = "ADMIN_AI_DRAFT_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

class InvalidAdminAiDraftError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidAdminAiDraftError";
    this.code = "GEMINI_INVALID_ADMIN_DRAFT";
  }
}

const getApiClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw httpError(
      "Gemini AI drafting is not configured on this server.",
      503,
      "GEMINI_NOT_CONFIGURED",
    );
  }
  return new GoogleGenAI({ apiKey });
};

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

const challengeSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: {
      type: "array",
      items: { type: "string" },
    },
    correctOptionIndex: { type: "integer" },
    category: { type: "string" },
    explanation: { type: "string" },
  },
  required: [
    "question",
    "options",
    "correctOptionIndex",
    "category",
    "explanation",
  ],
};

const pollSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["question", "options"],
};

const cleanText = (value, maxLength, label) => {
  const text = String(value ?? "").trim();
  if (!text) throw new InvalidAdminAiDraftError(`${label} is missing.`);
  if (text.length > maxLength) {
    throw new InvalidAdminAiDraftError(`${label} is too long.`);
  }
  return text;
};

const normalizeChallengeDraft = (draft, { difficulty, categoryHint }) => {
  if (!draft || typeof draft !== "object") {
    throw new InvalidAdminAiDraftError("Gemini returned an empty challenge draft.");
  }

  const options = Array.isArray(draft.options)
    ? draft.options.map((option) => cleanText(option, 240, "Challenge option"))
    : [];

  if (options.length !== 4) {
    throw new InvalidAdminAiDraftError(
      `Gemini returned ${options.length} challenge options instead of four.`,
    );
  }

  if (new Set(options.map((option) => option.toLowerCase())).size !== 4) {
    throw new InvalidAdminAiDraftError("Gemini returned duplicate challenge options.");
  }

  const correctOptionIndex = Number(draft.correctOptionIndex);
  if (
    !Number.isInteger(correctOptionIndex) ||
    correctOptionIndex < 0 ||
    correctOptionIndex > 3
  ) {
    throw new InvalidAdminAiDraftError("Gemini returned an invalid correct answer index.");
  }

  const category = String(draft.category || categoryHint || "General Knowledge").trim();

  return {
    question: cleanText(draft.question, 1000, "Challenge question"),
    options,
    correctOptionIndex,
    category: cleanText(category, 80, "Challenge category"),
    difficulty,
    explanation: cleanText(draft.explanation, 2000, "Challenge explanation"),
  };
};

const normalizePollDraft = (draft, { optionCount }) => {
  if (!draft || typeof draft !== "object") {
    throw new InvalidAdminAiDraftError("Gemini returned an empty poll draft.");
  }

  const options = Array.isArray(draft.options)
    ? draft.options.map((option) => cleanText(option, 240, "Poll option"))
    : [];

  if (options.length !== optionCount) {
    throw new InvalidAdminAiDraftError(
      `Gemini returned ${options.length} poll options instead of ${optionCount}.`,
    );
  }

  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    throw new InvalidAdminAiDraftError("Gemini returned duplicate poll options.");
  }

  return {
    question: cleanText(draft.question, 1000, "Poll question"),
    options,
  };
};

const buildChallengePrompt = ({ prompt, difficulty, categoryHint }) => `
You are drafting ONE Daily Challenge for the StudyFluxAI learner community.

ADMIN REQUEST
${prompt}

SETTINGS
- Difficulty: ${difficulty}
- Category hint: ${categoryHint || "Choose a concise, accurate category"}

RULES
1. Produce one objectively gradable multiple-choice question with exactly four distinct options.
2. Exactly one option must be clearly correct. Avoid ambiguity, trick wording, opinion questions, and multiple defensible answers.
3. Keep the challenge broadly educational and suitable for a general learner community while respecting the requested difficulty.
4. Distractors must be plausible and in the same subject domain as the correct answer.
5. The explanation must teach why the correct answer is correct in 1-3 concise sentences.
6. Return a concise category label. If the admin supplied a useful category hint, honor it.
7. Do not decide rewards, schedule, publishing status, or expiry. The admin controls those manually.
8. Return only the structured JSON requested by the response schema.
`.trim();

const buildPollPrompt = ({ prompt, optionCount }) => `
You are drafting ONE non-graded Community Poll for the StudyFluxAI learner community.

ADMIN REQUEST
${prompt}

SETTINGS
- Produce exactly ${optionCount} poll options.

RULES
1. This is an opinion/preference/community poll, not a quiz. There is no correct answer.
2. Write one neutral, easy-to-understand question that invites useful learner participation.
3. Produce exactly ${optionCount} distinct, concise options.
4. Avoid leading language, loaded assumptions, overlapping duplicate options, and options that reveal a preferred answer.
5. Keep all options parallel in style and granularity.
6. Do not decide schedule, publishing status, or expiry. The admin controls those manually.
7. Return only the structured JSON requested by the response schema.
`.trim();

const shouldUseFallback = (error) => {
  if (error?.code === "GEMINI_INVALID_ADMIN_DRAFT") return true;
  const status = Number(error?.status || error?.statusCode || 0);
  return FALLBACK_HTTP_STATUSES.has(status);
};

const generateWithModel = async ({ ai, model, prompt, schema, temperature }) => {
  const fallbackModel = String(
    process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ).trim();
  const timeoutMs = model === fallbackModel ? FALLBACK_TIMEOUT_MS : PRIMARY_TIMEOUT_MS;

  const response = await runWithTimeout(
    () =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature,
        },
      }),
    timeoutMs,
    model,
  );

  if (!response.text) {
    throw new InvalidAdminAiDraftError("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(response.text);
  } catch {
    throw new InvalidAdminAiDraftError("Gemini returned malformed structured output.");
  }
};

const generateDraftWithFallback = async ({ prompt, schema, temperature, normalize }) => {
  const ai = getApiClient();
  const primaryModel = String(
    process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL,
  ).trim();
  const fallbackModel = String(
    process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ).trim();

  const startedAt = Date.now();

  try {
    const raw = await generateWithModel({
      ai,
      model: primaryModel,
      prompt,
      schema,
      temperature,
    });

    return {
      draft: normalize(raw),
      meta: {
        modelUsed: primaryModel,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (primaryError) {
    if (
      !fallbackModel ||
      fallbackModel === primaryModel ||
      !shouldUseFallback(primaryError)
    ) {
      if (primaryError?.code === "GEMINI_NOT_CONFIGURED") throw primaryError;
      console.error("Admin AI draft failed on primary model:", safeErrorDetails(primaryError));
      throw httpError(
        "AI could not create a valid draft right now. You can retry or continue manually.",
        502,
        "ADMIN_AI_DRAFT_FAILED",
      );
    }

    console.warn(
      `Admin AI primary model ${primaryModel} failed; trying ${fallbackModel}: ${primaryError.message}`,
    );

    try {
      const raw = await generateWithModel({
        ai,
        model: fallbackModel,
        prompt,
        schema,
        temperature,
      });

      return {
        draft: normalize(raw),
        meta: {
          modelUsed: fallbackModel,
          fallbackUsed: true,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (fallbackError) {
      console.error("Admin AI draft failed on fallback model:", safeErrorDetails(fallbackError));
      throw httpError(
        "AI could not create a valid draft right now. You can retry or continue manually.",
        502,
        "ADMIN_AI_DRAFT_FAILED",
      );
    }
  }
};

const normalizeDifficulty = (value) =>
  ["easy", "medium", "hard"].includes(value) ? value : "medium";

export const generateAdminChallengeDraft = async (payload = {}) => {
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) throw httpError("Tell AI what challenge you want to create.");
  if (prompt.length > 800) throw httpError("AI challenge instructions are too long.");

  const difficulty = normalizeDifficulty(payload.difficulty);
  const categoryHint = String(payload.category || "").trim().slice(0, 80);

  return generateDraftWithFallback({
    prompt: buildChallengePrompt({ prompt, difficulty, categoryHint }),
    schema: challengeSchema,
    temperature: 0.35,
    normalize: (draft) =>
      normalizeChallengeDraft(draft, { difficulty, categoryHint }),
  });
};

export const generateAdminPollDraft = async (payload = {}) => {
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) throw httpError("Tell AI what poll you want to create.");
  if (prompt.length > 800) throw httpError("AI poll instructions are too long.");

  const optionCount = Number(payload.optionCount ?? 4);
  if (!Number.isInteger(optionCount) || optionCount < 2 || optionCount > 6) {
    throw httpError("Poll option count must be a whole number from 2 to 6.");
  }

  return generateDraftWithFallback({
    prompt: buildPollPrompt({ prompt, optionCount }),
    schema: pollSchema,
    temperature: 0.6,
    normalize: (draft) => normalizePollDraft(draft, { optionCount }),
  });
};