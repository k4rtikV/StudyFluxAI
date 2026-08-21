import { GoogleGenAI } from "@google/genai";

import { getNumberEnv } from "../config/env.js";

const DEFAULT_INTERVIEW_MODEL = "gemini-3.6-flash";
const DEFAULT_INTERVIEW_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_FALLBACK_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_TTS_VOICE = "Kore";

const FALLBACK_HTTP_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);
const MODEL_TIMEOUT_MS = getNumberEnv("INTERVIEW_GEMINI_TIMEOUT_MS", 60000);
const TTS_TIMEOUT_MS = getNumberEnv("INTERVIEW_TTS_TIMEOUT_MS", 20000);

const firstQuestionSchema = {
  type: "object",
  properties: {
    resumeContext: { type: "string" },
    question: {
      type: "object",
      properties: {
        text: { type: "string" },
        category: { type: "string" },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        rationale: { type: "string" },
      },
      required: ["text", "category", "difficulty", "rationale"],
    },
  },
  required: ["resumeContext", "question"],
};

const answerEvaluationSchema = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    evaluation: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 100 },
        relevance: { type: "integer", minimum: 0, maximum: 10 },
        correctness: { type: "integer", minimum: 0, maximum: 10 },
        clarity: { type: "integer", minimum: 0, maximum: 10 },
        completeness: { type: "integer", minimum: 0, maximum: 10 },
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
      },
      required: [
        "score",
        "relevance",
        "correctness",
        "clarity",
        "completeness",
        "strengths",
        "improvements",
        "summary",
      ],
    },
    nextQuestion: {
      type: "object",
      properties: {
        text: { type: "string" },
        category: { type: "string" },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        rationale: { type: "string" },
      },
      required: ["text", "category", "difficulty", "rationale"],
    },
    shouldComplete: { type: "boolean" },
  },
  required: ["transcript", "evaluation", "nextQuestion", "shouldComplete"],
};

const finalReportSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    readinessBand: {
      type: "string",
      enum: ["strong", "developing", "needs_practice"],
    },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    improvements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    practicePlan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          focus: { type: "string" },
          action: { type: "string" },
        },
        required: ["priority", "focus", "action"],
      },
    },
    closingNote: { type: "string" },
  },
  required: [
    "headline",
    "summary",
    "readinessBand",
    "strengths",
    "improvements",
    "practicePlan",
    "closingNote",
  ],
};

class InterviewGeminiError extends Error {
  constructor(message, code = "INTERVIEW_GEMINI_FAILED", statusCode = 502) {
    super(message);
    this.name = "InterviewGeminiError";
    this.code = code;
    this.status = statusCode;
    this.statusCode = statusCode;
  }
}

const geminiStatus = (error) =>
  Number(
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.cause?.status ||
    0,
  );

const isQuotaError = (error) => {
  const status = geminiStatus(error);
  const message = String(error?.message || error?.cause?.message || "");
  return status === 429 || /RESOURCE_EXHAUSTED|quota|rate[ -]?limit|too many requests/i.test(message);
};

const normalizeGeminiError = (error, operation = "interview") => {
  if (error instanceof InterviewGeminiError) return error;

  if (isQuotaError(error)) {
    if (operation === "tts") {
      return new InterviewGeminiError(
        "Astra's voice quota is temporarily exhausted. You can continue from the visible question, or retry voice after the Gemini quota resets.",
        "GEMINI_TTS_QUOTA_EXHAUSTED",
        429,
      );
    }

    return new InterviewGeminiError(
      "Gemini's interview-generation quota is temporarily exhausted. Your interview is saved; retry this step after the quota resets.",
      "GEMINI_QUOTA_EXHAUSTED",
      429,
    );
  }

  const status = geminiStatus(error);
  if (status === 401 || status === 403) {
    return new InterviewGeminiError(
      "Gemini could not authenticate the interview request. Check the server API key and model access.",
      "GEMINI_AUTH_FAILED",
      502,
    );
  }

  if (status === 404) {
    return new InterviewGeminiError(
      "The configured Gemini interview model is unavailable. Check the interview model settings.",
      "GEMINI_MODEL_UNAVAILABLE",
      502,
    );
  }

  if (status >= 500) {
    return new InterviewGeminiError(
      "Gemini is temporarily unavailable for Smart Interview. Your interview state is saved; try again shortly.",
      "GEMINI_TEMPORARILY_UNAVAILABLE",
      503,
    );
  }

  return error;
};

const getClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new InterviewGeminiError(
      "GEMINI_API_KEY is missing from the server environment.",
      "GEMINI_NOT_CONFIGURED",
    );
  }
  return new GoogleGenAI({ apiKey });
};

const runWithTimeout = (operation, timeoutMs, label) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new InterviewGeminiError(
        `${label} did not respond within ${Math.round(timeoutMs / 1000)} seconds.`,
        "GEMINI_MODEL_TIMEOUT",
        504,
      );
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

const shouldFallback = (error) => {
  const status = Number(error?.status || error?.statusCode || 0);
  return FALLBACK_HTTP_STATUSES.has(status) || error?.code === "GEMINI_MODEL_TIMEOUT";
};

const normalizeQuestion = (question = {}) => ({
  text: String(question.text || "").trim().slice(0, 1200),
  category: String(question.category || "Role fit").trim().slice(0, 100),
  difficulty: ["easy", "medium", "hard"].includes(question.difficulty)
    ? question.difficulty
    : "medium",
  rationale: String(question.rationale || "").trim().slice(0, 700),
});

const validateQuestion = (question) => {
  const normalized = normalizeQuestion(question);
  if (normalized.text.length < 8) {
    throw new InterviewGeminiError("Gemini returned an unusable interview question.", "GEMINI_INVALID_OUTPUT");
  }
  return normalized;
};

const cleanStringArray = (value, limit = 5) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];

const normalizeEvaluation = (output = {}) => {
  const evaluation = output.evaluation || {};
  const clamp = (value, max) => Math.max(0, Math.min(max, Number(value || 0)));
  return {
    transcript: String(output.transcript || "").trim().slice(0, 12000),
    evaluation: {
      score: Math.round(clamp(evaluation.score, 100)),
      relevance: Math.round(clamp(evaluation.relevance, 10)),
      correctness: Math.round(clamp(evaluation.correctness, 10)),
      clarity: Math.round(clamp(evaluation.clarity, 10)),
      completeness: Math.round(clamp(evaluation.completeness, 10)),
      strengths: cleanStringArray(evaluation.strengths),
      improvements: cleanStringArray(evaluation.improvements),
      summary: String(evaluation.summary || "").trim().slice(0, 1200),
    },
    nextQuestion: normalizeQuestion(output.nextQuestion || {}),
    shouldComplete: Boolean(output.shouldComplete),
  };
};

const cleanReportItems = (value, limit = 5) =>
  Array.isArray(value)
    ? value
        .map((item) => ({
          title: String(item?.title || "").trim().slice(0, 140),
          detail: String(item?.detail || "").trim().slice(0, 900),
        }))
        .filter((item) => item.title && item.detail)
        .slice(0, limit)
    : [];

const cleanPracticePlan = (value, limit = 5) =>
  Array.isArray(value)
    ? value
        .map((item) => ({
          priority: ["high", "medium", "low"].includes(item?.priority)
            ? item.priority
            : "medium",
          focus: String(item?.focus || "").trim().slice(0, 160),
          action: String(item?.action || "").trim().slice(0, 900),
        }))
        .filter((item) => item.focus && item.action)
        .slice(0, limit)
    : [];

const normalizeFinalReportNarrative = (output = {}) => ({
  headline: String(output.headline || "Interview practice report").trim().slice(0, 220),
  summary: String(output.summary || "").trim().slice(0, 2400),
  readinessBand: ["strong", "developing", "needs_practice"].includes(output.readinessBand)
    ? output.readinessBand
    : "developing",
  strengths: cleanReportItems(output.strengths),
  improvements: cleanReportItems(output.improvements),
  practicePlan: cleanPracticePlan(output.practicePlan),
  closingNote: String(output.closingNote || "").trim().slice(0, 1200),
});

const experienceGuidance = {
  fresher: "student/fresher: test foundations, reasoning, projects and learning ability; do not assume professional production experience",
  entry: "entry level: test solid fundamentals plus practical application and debugging",
  junior: "junior: test implementation depth, trade-offs and common production scenarios",
  mid: "mid level: test architecture, trade-offs, ownership, reliability and deeper problem solving",
  senior: "senior: test systems thinking, architecture, leadership trade-offs, reliability and ambiguity",
};

const typeGuidance = {
  behavioral: "Prioritize behavioral and HR questions. Evaluate relevance, specificity, ownership, reflection and STAR-like structure where appropriate.",
  technical: "Prioritize technical concepts, correctness, reasoning, practical scenarios and progressively deeper follow-ups.",
  coding: "Prioritize coding/problem-solving discussion. Until the dedicated editor is active, ask verbal algorithm, debugging, complexity and implementation-reasoning questions rather than requiring code entry.",
  mixed: "Use a balanced sequence of technical, project, behavioral and problem-solving questions. Transition naturally based on the learner's previous answers.",
};

const formatProfile = (profile = {}) => [
  `Education level: ${profile.educationLevel || "unknown"}`,
  `Institution: ${profile.institutionName || "not provided"}`,
  `Program: ${profile.program || "not provided"}`,
  `Stream / specialization: ${profile.stream || "not provided"}`,
].join("\n");

const learnerProfileForPrompt = (interview) =>
  interview?.useLearnerProfile === false
    ? "Learner profile excluded from interview scope by the candidate. Do not infer or use education, institution, program, or stream details."
    : formatProfile(interview?.profileSnapshot || {});

const resumeTextForPrompt = (interview) => {
  if (!interview.resume?.content) return "No resume was attached.";
  const mime = String(interview.resume.mimeType || "").toLowerCase();
  if (mime === "text/plain" || mime.includes("markdown")) {
    const value = Buffer.from(interview.resume.content).toString("utf8").trim();
    return value ? value.slice(0, 30000) : "Resume text was empty.";
  }
  return "A PDF resume is attached as an inline document to this request.";
};

const firstQuestionPrompt = (interview) => `
You are Astra, StudyFluxAI's professional mock interviewer.

Create the FIRST question for this interview and, if a resume is available, create a concise reusable resumeContext summary for later turns.

PERSISTENT INTERVIEW CONTEXT
Target role: ${interview.targetRole}
Experience calibration: ${experienceGuidance[interview.experienceLevel] || interview.experienceLevel}
Interview type: ${interview.interviewType}
Interview-type guidance: ${typeGuidance[interview.interviewType] || typeGuidance.mixed}

LEARNER PROFILE SCOPE
${learnerProfileForPrompt(interview)}

RESUME
${resumeTextForPrompt(interview)}

RULES
1. Personalize from the target role, experience level, permitted learner-profile context, and relevant resume/project context when available. If learner profile scope is excluded, do not use or infer it.
2. Do not make every question sound like "I saw on your resume". This is only the opening turn.
3. Keep the spoken question concise: usually 1-3 sentences and under 90 words.
4. Do not ask for sensitive personal data.
5. Do not ask a question whose answer is already explicitly stated as a simple fact in the context; test reasoning/application instead.
6. Calibrate difficulty to the selected experience level. A fresher should not be penalized for lacking senior production ownership.
7. resumeContext should capture only interview-relevant skills, projects, technologies and experience. If no resume is attached, return an empty string.
8. rationale is internal metadata explaining why the question fits; do not address the learner in the rationale.
`.trim();

const compactHistory = (interview) =>
  (interview.transcript || [])
    .slice(-7)
    .map((turn) => ({
      questionNumber: turn.questionNumber,
      question: turn.question?.text || "",
      answer: turn.answerTranscript || (turn.completionReason === "no_speech" ? "[No verbal response]" : ""),
      score: Number(turn.evaluation?.score || 0),
      summary: turn.evaluation?.summary || "",
    }));

const evaluationPrompt = ({ interview, currentQuestion, completionReason, questionNumber }) => `
You are Astra, StudyFluxAI's adaptive professional mock interviewer.

Evaluate the learner's CURRENT spoken answer, create an accurate transcript, and choose the next question.

PERSISTENT INTERVIEW CONTEXT
Target role: ${interview.targetRole}
Experience calibration: ${experienceGuidance[interview.experienceLevel] || interview.experienceLevel}
Interview type: ${interview.interviewType}
Interview-type guidance: ${typeGuidance[interview.interviewType] || typeGuidance.mixed}
Learner profile scope:\n${learnerProfileForPrompt(interview)}
Resume context: ${interview.resumeContext || "No resume context available."}

CURRENT QUESTION ${questionNumber} OF ${interview.maxQuestions}
${currentQuestion.text}
Category: ${currentQuestion.category}
Difficulty: ${currentQuestion.difficulty}
Answer completion reason: ${completionReason}

RECENT INTERVIEW HISTORY
${JSON.stringify(compactHistory(interview), null, 2)}

EVALUATION RULES
1. Transcript the learner's speech faithfully. Clean obvious filler-only repetitions, but do not invent content.
2. Score 0-100 using an interview-appropriate rubric.
3. relevance, correctness, clarity and completeness are each 0-10. For behavioral answers, "correctness" means factual/coherent fit to the scenario rather than a single technical truth.
4. Evaluate answer content only. Do not infer personality, intelligence, mental state, honesty or protected/sensitive traits from voice.
5. Do not use accent, pitch, gender presentation, or vocal characteristics as scoring criteria.
6. For behavioral questions, consider specificity, ownership, reflection and STAR-like structure where useful.
7. For technical/coding questions, consider correctness, concepts, trade-offs, reasoning and complexity where relevant.
8. If completionReason is no_speech, transcript must be "" and the evaluation should reflect that no answer was provided.

ADAPTIVE NEXT-QUESTION RULES
1. Every next question must fit the target role, experience level, permitted learner-profile context, and relevant resume context. If learner profile scope is excluded, do not use or infer it.
2. Also adapt to what the learner has actually said so far. Strong answers can deepen; weak answers can probe or step back.
3. Avoid repeats and trivial rephrasings of previous questions.
4. Mix resume/project-grounded and general role-relevant questions naturally; do not make the resume dominate every turn.
5. Keep questions concise and natural to hear aloud.
6. The interview target is exactly ${interview.maxQuestions} questions. Set shouldComplete=true after evaluating question ${interview.maxQuestions}. Otherwise shouldComplete=false and provide the next question.
7. When shouldComplete=true, return nextQuestion with an empty text/category/rationale and difficulty="medium".
`.trim();

const callStructured = async ({ ai, model, contents, schema }) => {
  const response = await runWithTimeout(
    () => ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.35,
      },
    }),
    MODEL_TIMEOUT_MS,
    model,
  );

  if (!response.text) {
    throw new InterviewGeminiError("Gemini returned an empty interview response.", "GEMINI_INVALID_OUTPUT");
  }

  try {
    return JSON.parse(response.text);
  } catch {
    throw new InterviewGeminiError("Gemini returned malformed interview data.", "GEMINI_INVALID_OUTPUT");
  }
};

const runStructuredWithFallback = async ({ contents, schema }) => {
  const ai = getClient();
  const primary = String(process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_PRIMARY_MODEL || DEFAULT_INTERVIEW_MODEL).trim();
  const fallback = String(process.env.INTERVIEW_GEMINI_FALLBACK_MODEL || process.env.GEMINI_FALLBACK_MODEL || DEFAULT_INTERVIEW_FALLBACK_MODEL).trim();

  try {
    const output = await callStructured({ ai, model: primary, contents, schema });
    return { output, model: primary, usedFallback: false };
  } catch (primaryError) {
    if (!fallback || fallback === primary || (!shouldFallback(primaryError) && primaryError?.code !== "GEMINI_INVALID_OUTPUT")) {
      throw normalizeGeminiError(primaryError, "interview");
    }

    try {
      const output = await callStructured({ ai, model: fallback, contents, schema });
      return { output, model: fallback, usedFallback: true };
    } catch (fallbackError) {
      throw normalizeGeminiError(fallbackError, "interview");
    }
  }
};

export const generateFirstInterviewQuestion = async (interview) => {
  const prompt = firstQuestionPrompt(interview);
  const hasPdf = interview.resume?.content && String(interview.resume.mimeType || "").toLowerCase() === "application/pdf";
  const contents = hasPdf
    ? [
        {
          inlineData: {
            data: Buffer.from(interview.resume.content).toString("base64"),
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ]
    : prompt;

  const { output, model, usedFallback } = await runStructuredWithFallback({ contents, schema: firstQuestionSchema });
  return {
    resumeContext: String(output.resumeContext || "").trim().slice(0, 12000),
    question: validateQuestion(output.question),
    model,
    usedFallback,
  };
};

export const evaluateInterviewAnswer = async ({ interview, answerFile, completionReason }) => {
  const currentQuestion = interview.currentQuestion;
  if (!currentQuestion?.id) throw new InterviewGeminiError("Interview question is unavailable.", "INTERVIEW_QUESTION_MISSING");

  const prompt = evaluationPrompt({
    interview,
    currentQuestion,
    completionReason,
    questionNumber: Number(currentQuestion.sequence || interview.questionCount || 1),
  });

  const contents = completionReason === "no_speech"
    ? `${prompt}\n\nNo audio was submitted because StudyFluxAI detected no speech before the timeout.`
    : [
        {
          inlineData: {
            data: answerFile.buffer.toString("base64"),
            mimeType: answerFile.mimetype === "audio/x-wav" ? "audio/wav" : answerFile.mimetype,
          },
        },
        { text: prompt },
      ];

  const { output, model, usedFallback } = await runStructuredWithFallback({ contents, schema: answerEvaluationSchema });
  const normalized = normalizeEvaluation(output);
  const currentSequence = Number(currentQuestion.sequence || 1);
  const mustComplete = currentSequence >= Number(interview.maxQuestions || 8);
  normalized.shouldComplete = mustComplete || normalized.shouldComplete;
  if (!normalized.shouldComplete) normalized.nextQuestion = validateQuestion(normalized.nextQuestion);
  else normalized.nextQuestion = { text: "", category: "", difficulty: "medium", rationale: "" };

  return { ...normalized, model, usedFallback };
};

const reportHistory = (interview) =>
  (interview.transcript || []).map((turn) => ({
    questionNumber: Number(turn.questionNumber || 0),
    question: turn.question?.text || "",
    category: turn.question?.category || "",
    difficulty: turn.question?.difficulty || "medium",
    answer: turn.answerTranscript || (turn.completionReason === "no_speech" ? "[No verbal response]" : ""),
    completionReason: turn.completionReason || "",
    durationSeconds: Math.round(Number(turn.answerDurationMs || 0) / 1000),
    evaluation: {
      score: Number(turn.evaluation?.score || 0),
      relevance: Number(turn.evaluation?.relevance || 0),
      correctness: Number(turn.evaluation?.correctness || 0),
      clarity: Number(turn.evaluation?.clarity || 0),
      completeness: Number(turn.evaluation?.completeness || 0),
      summary: turn.evaluation?.summary || "",
      strengths: Array.isArray(turn.evaluation?.strengths) ? turn.evaluation.strengths : [],
      improvements: Array.isArray(turn.evaluation?.improvements) ? turn.evaluation.improvements : [],
    },
  }));

const finalReportPrompt = (interview, metrics) => `
You are Astra, StudyFluxAI's professional mock-interview coach.

Create the FINAL PRACTICE REPORT narrative for the completed interview below.

IMPORTANT
- The numeric overall score and rubric averages are already calculated by StudyFluxAI from the per-question evaluations. Do NOT invent or replace those numbers.
- This is practice feedback, not a hiring decision or psychological assessment.
- Do not infer personality, intelligence, honesty, mental state, protected traits, or employability from voice.
- Do not use accent, pitch, gender presentation, or other vocal characteristics as evaluation criteria.
- Ground every strength/improvement in the answers and evaluations that were actually recorded.
- Be useful to a learner at the selected experience level.
- Avoid generic praise. Prefer concrete, actionable observations.
- The report should remain constructive even when there were unanswered questions.

INTERVIEW CONTEXT
Target role: ${interview.targetRole}
Experience calibration: ${experienceGuidance[interview.experienceLevel] || interview.experienceLevel}
Interview type: ${interview.interviewType}
Learner profile scope:
${learnerProfileForPrompt(interview)}
Resume context: ${interview.resumeContext || "No resume context available."}

DETERMINISTIC METRICS
${JSON.stringify(metrics, null, 2)}

FULL INTERVIEW TRANSCRIPT + SAVED PER-TURN EVALUATIONS
${JSON.stringify(reportHistory(interview), null, 2)}

OUTPUT GUIDANCE
1. headline: concise description of the learner's current interview performance.
2. summary: 2-4 short paragraphs synthesizing the full interview.
3. readinessBand:
   - strong: generally role-ready for this practice level with targeted polish remaining.
   - developing: useful foundations but multiple areas need more consistent interview-ready depth.
   - needs_practice: substantial gaps/no-responses currently prevent consistent interview performance.
4. strengths: 2-5 evidence-based strengths.
5. improvements: 2-5 highest-value improvements.
6. practicePlan: 3-5 concrete next actions, prioritized high/medium/low.
7. closingNote: short encouraging but realistic closing statement.
`.trim();

export const generateFinalInterviewReport = async ({ interview, metrics }) => {
  const { output, model, usedFallback } = await runStructuredWithFallback({
    contents: finalReportPrompt(interview, metrics),
    schema: finalReportSchema,
  });

  return {
    narrative: normalizeFinalReportNarrative(output),
    model,
    usedFallback,
  };
};

const pcmToWav = (pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) => {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
};

const callTts = async ({ ai, model, questionText, voice }) => {
  const response = await runWithTimeout(
    () => ai.models.generateContent({
      model,
      contents: [{
        parts: [{
          text: `You are Astra, a calm professional mock interviewer. Speak clearly, naturally and neutrally at a moderate pace. Ask exactly this interview question and do not add commentary:\n\n${questionText}`,
        }],
      }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
    TTS_TIMEOUT_MS,
    model,
  );

  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new InterviewGeminiError("Gemini TTS returned no audio.", "GEMINI_TTS_EMPTY");
  return pcmToWav(Buffer.from(data, "base64"));
};

export const generateInterviewQuestionAudio = async ({ questionText, voice = DEFAULT_TTS_VOICE }) => {
  const ai = getClient();
  const primary = String(process.env.INTERVIEW_TTS_MODEL || DEFAULT_TTS_MODEL).trim();
  const fallback = String(process.env.INTERVIEW_TTS_FALLBACK_MODEL || DEFAULT_TTS_FALLBACK_MODEL).trim();
  const selectedVoice = String(process.env.INTERVIEW_TTS_VOICE || voice || DEFAULT_TTS_VOICE).trim() || DEFAULT_TTS_VOICE;
  const startedAt = Date.now();

  try {
    const wav = await callTts({ ai, model: primary, questionText, voice: selectedVoice });
    return { wav, model: primary, usedFallback: false, voice: selectedVoice, durationMs: Date.now() - startedAt };
  } catch (primaryError) {
    if (!fallback || fallback === primary || (!shouldFallback(primaryError) && primaryError?.code !== "GEMINI_TTS_EMPTY")) {
      throw normalizeGeminiError(primaryError, "tts");
    }

    const fallbackStartedAt = Date.now();
    try {
      const wav = await callTts({ ai, model: fallback, questionText, voice: selectedVoice });
      return {
        wav,
        model: fallback,
        usedFallback: true,
        voice: selectedVoice,
        durationMs: Date.now() - startedAt,
        fallbackDurationMs: Date.now() - fallbackStartedAt,
      };
    } catch (fallbackError) {
      throw normalizeGeminiError(fallbackError, "tts");
    }
  }
};

export { InterviewGeminiError };