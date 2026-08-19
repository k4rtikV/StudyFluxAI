import { GoogleGenAI } from "@google/genai";

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

class EmptyTutorResponseError extends Error {
  constructor() {
    super("Gemini returned an empty Tutor response.");
    this.name = "EmptyTutorResponseError";
    this.code = "GEMINI_EMPTY_TUTOR_RESPONSE";
  }
}

class TruncatedTutorResponseError extends Error {
  constructor(message = "Gemini could not finish the Tutor response within the continuation limit.") {
    super(message);
    this.name = "TruncatedTutorResponseError";
    this.code = "GEMINI_TUTOR_TRUNCATED";
    this.status = 503;
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

const cleanModelError = (error) => {
  const status = Number(error?.status || error?.statusCode || 0);

  return {
    status,
    code: error?.code || "GEMINI_TUTOR_REQUEST_FAILED",
    message:
      error?.message ||
      "Gemini could not answer the Tutor question.",
  };
};

const shouldUseFallback = (error) => {
  if (
    error?.code === "GEMINI_EMPTY_TUTOR_RESPONSE" ||
    error?.code === "GEMINI_TUTOR_TRUNCATED"
  ) {
    return true;
  }

  const status = Number(error?.status || error?.statusCode || 0);
  return FALLBACK_HTTP_STATUSES.has(status);
};

const buildAcademicContext = (profile) => {
  const lines = [];

  if (profile?.educationLevel) {
    lines.push(`Education level: ${profile.educationLevel}`);
  }

  if (profile?.institutionName) {
    lines.push(`Institution / board: ${profile.institutionName}`);
  }

  if (profile?.institutionState) {
    lines.push(`State / UT: ${profile.institutionState}`);
  }

  if (profile?.program) {
    lines.push(`Program / degree: ${profile.program}`);
  }

  if (profile?.stream) {
    lines.push(`Stream / specialization: ${profile.stream}`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "Use a clear general-learning level.";
};

const normalizeStudyContext = (studySession) => {
  if (!studySession?.output) {
    return "";
  }

  const safeContext = {
    title:
      studySession.output?.sessionTitle ||
      studySession.topic ||
      studySession.sourceFile?.fileName ||
      "Saved StudyFluxAI learning session",
    description: studySession.output?.shortDescription || "",
    generationType: studySession.generationType || "combined",
    notes: studySession.output?.notes || null,
    quiz: studySession.output?.quiz || null,
  };

  const serialized = JSON.stringify(safeContext, null, 2);
  const maxChars = Math.max(
    Number(process.env.TUTOR_STUDY_CONTEXT_MAX_CHARS || 24000),
    4000,
  );

  if (serialized.length <= maxChars) {
    return serialized;
  }

  return `${serialized.slice(0, maxChars)}\n[Study context truncated for Tutor context size.]`;
};

const buildSystemInstruction = ({
  academicContext,
  studySession,
}) => {
  const studyContext = normalizeStudyContext(studySession);

  return `
You are StudyFluxAI Tutor, a patient, accurate learning assistant.

LEARNER CONTEXT
${buildAcademicContext(academicContext)}

TUTORING RULES
1. Match the learner's academic level and terminology. Do not repeatedly restate their profile.
2. Teach the reasoning, not just the final answer. Break difficult ideas into understandable steps.
3. Prefer concise explanations first, then add detail when it genuinely helps.
4. When useful, use a small worked example, analogy, comparison, checklist, or short practice question.
5. If the learner is mistaken, correct the misconception clearly and respectfully.
6. Never claim that a saved StudyFluxAI note says something unless it is present in the supplied saved-session context.
7. If the learner asks about an attached saved StudyFluxAI session, ground the answer in that context and say when the requested detail is not present there.
8. Format answers using clean GitHub-flavored Markdown when structure helps. Use ### headings for meaningful sections, normal ordered/unordered lists, and fenced code blocks with a language when practical.
9. For side-by-side comparisons, use a valid Markdown table only when a table genuinely improves clarity. Keep tables compact (prefer 2-4 columns), include a header row and divider row, and never simulate a table with loose pipe characters.
10. For formulas and scientific notation, prefer readable Unicode/plain text such as G₁, G₂, 2n, ATP/NADPH, x², or A → B. Do not wrap formulas in LaTeX dollar delimiters ($...$ or $$...$$) and do not emit raw LaTeX commands.
11. Use **bold** sparingly for key terms. Do not expose Markdown syntax accidentally, and do not use decorative horizontal rules unless they improve readability.
12. Do not output JSON. Respond as a natural Tutor message.
13. Do not invent citations, sources, page numbers, marks, syllabus rules, or current facts.
14. If a question requires current information you cannot verify from the supplied context, state that limitation instead of fabricating an answer.
15. Complete the learner's requested task before ending the response. If they request a fixed number of items (for example 5 questions or 3 steps), include all of them.
16. When you create a multiple-choice quiz, make every question self-contained with exactly four options labelled A-D. Include an explicit **Answer:** line and a concise **Explanation:** for each question so StudyFluxAI can reliably save that quiz to Study Library later.
17. StudyFluxAI can save eligible Tutor quizzes through its own UI. Do not claim that you created a downloadable file or Study Library artifact unless the app confirms that action.

${
  studyContext
    ? `SAVED STUDYFLUXAI SESSION CONTEXT
The learner intentionally attached the following saved learning session to this Tutor conversation:
---
${studyContext}
---`
    : "No saved StudyFluxAI session is attached to this conversation."
}
`.trim();
};

const toGeminiHistory = (messages) =>
  messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

const getFinishReason = (response) =>
  response?.candidates?.[0]?.finishReason ?? "";

const isMaxTokensFinish = (finishReason) => {
  const normalized = String(finishReason || "")
    .trim()
    .toUpperCase();

  // MAX_TOKENS is the documented enum value. Numeric 2 is retained as
  // a defensive compatibility path for older/serialized SDK responses.
  return normalized === "MAX_TOKENS" || Number(finishReason) === 2;
};

const getOutputTokenLimit = () =>
  Math.max(
    Number(process.env.TUTOR_MAX_OUTPUT_TOKENS || 2400),
    512,
  );

const getMaxContinuations = () =>
  Math.min(
    Math.max(
      Number(process.env.TUTOR_MAX_CONTINUATIONS || 2),
      0,
    ),
    4,
  );

const getContinuationInstruction = () => `
Continue the Tutor answer from exactly where it stopped.
- Do not repeat any content already written.
- Finish every remaining part of the learner's original request.
- If a numbered list, quiz, table, explanation, or section was incomplete, continue and complete it.
- Return continuation content only; do not add an apology or a new introduction.
`.trim();

const mergeContinuation = (existingText, continuationText) => {
  const existing = String(existingText || "").trimEnd();
  let continuation = String(continuationText || "").trim();

  if (!existing) {
    return continuation;
  }

  if (!continuation) {
    return existing;
  }

  // Remove a small exact overlap if the model repeats the end of the prior
  // chunk despite being told to continue only.
  const maxOverlap = Math.min(existing.length, continuation.length, 600);

  for (let size = maxOverlap; size >= 24; size -= 1) {
    const suffix = existing.slice(-size);
    const prefix = continuation.slice(0, size);

    if (suffix === prefix) {
      continuation = continuation.slice(size).trimStart();
      break;
    }
  }

  return continuation
    ? `${existing}\n\n${continuation}`
    : existing;
};

const requestModelChunk = async ({
  ai,
  model,
  systemInstruction,
  contents,
}) => {
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.5,
      maxOutputTokens: getOutputTokenLimit(),
    },
  });

  const finishReason = getFinishReason(response);

  let text = "";

  try {
    text = String(response.text || "").trim();
  } catch (error) {
    if (!isMaxTokensFinish(finishReason)) {
      throw error;
    }
  }

  if (!text) {
    if (isMaxTokensFinish(finishReason)) {
      throw new TruncatedTutorResponseError(
        "Gemini reached its output limit before producing a usable Tutor response.",
      );
    }

    throw new EmptyTutorResponseError();
  }

  return {
    text,
    finishReason,
    truncated: isMaxTokensFinish(finishReason),
  };
};

const generateWithModel = async ({
  ai,
  model,
  systemInstruction,
  history,
  question,
}) => {
  const baseContents = [
    ...toGeminiHistory(history),
    {
      role: "user",
      parts: [{ text: question }],
    },
  ];

  let chunk = await requestModelChunk({
    ai,
    model,
    systemInstruction,
    contents: baseContents,
  });

  let text = chunk.text;
  let continuationCount = 0;
  const maxContinuations = getMaxContinuations();

  while (chunk.truncated && continuationCount < maxContinuations) {
    continuationCount += 1;

    chunk = await requestModelChunk({
      ai,
      model,
      systemInstruction,
      contents: [
        ...baseContents,
        {
          role: "model",
          parts: [{ text }],
        },
        {
          role: "user",
          parts: [{ text: getContinuationInstruction() }],
        },
      ],
    });

    text = mergeContinuation(text, chunk.text);
  }

  if (chunk.truncated) {
    throw new TruncatedTutorResponseError();
  }

  return {
    text,
    continuationCount,
  };
};

export const generateTutorReply = async ({
  academicContext,
  studySession,
  history,
  question,
}) => {
  const ai = getApiClient();

  const primaryModel = String(
    process.env.GEMINI_PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL,
  ).trim();

  const fallbackModel = String(
    process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  ).trim();

  const systemInstruction = buildSystemInstruction({
    academicContext,
    studySession,
  });

  try {
    const generation = await generateWithModel({
      ai,
      model: primaryModel,
      systemInstruction,
      history,
      question,
    });

    return {
      text: generation.text,
      modelUsed: primaryModel,
      fallbackUsed: false,
      continuationCount: generation.continuationCount,
    };
  } catch (primaryError) {
    if (
      !fallbackModel ||
      fallbackModel === primaryModel ||
      !shouldUseFallback(primaryError)
    ) {
      const cleaned = cleanModelError(primaryError);
      const error = new Error(cleaned.message);
      Object.assign(error, cleaned);
      throw error;
    }

    console.warn(
      `Gemini Tutor primary model ${primaryModel} failed; trying ${fallbackModel}: ${primaryError.message}`,
    );

    try {
      const generation = await generateWithModel({
        ai,
        model: fallbackModel,
        systemInstruction,
        history,
        question,
      });

      return {
        text: generation.text,
        modelUsed: fallbackModel,
        fallbackUsed: true,
        continuationCount: generation.continuationCount,
      };
    } catch (fallbackError) {
      const cleaned = cleanModelError(fallbackError);
      const error = new Error(cleaned.message);
      error.code = "GEMINI_TUTOR_ALL_MODELS_FAILED";
      error.status = cleaned.status;
      error.primaryError = cleanModelError(primaryError);
      error.fallbackError = cleaned;
      throw error;
    }
  }
};
