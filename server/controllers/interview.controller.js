import mongoose from "mongoose";

import InterviewSession from "../models/InterviewSession.js";
import {
  beginSmartInterview,
  getInterviewEligibility,
  getSmartInterviewQuestionAudio,
  initializeSmartInterview,
  INTERVIEW_COST,
  INTERVIEW_QUESTION_COUNT,
  InterviewEligibilityError,
  InterviewInsufficientFluxGemsError,
  InterviewStateError,
  submitSmartInterviewAnswer,
} from "../services/interview.service.js";
import { validateInterviewAnswerInput } from "../utils/interviewTurnValidation.js";
import { validateInterviewStartInput } from "../utils/interviewValidation.js";
import { queueSmartInterviewReport } from "../services/interviewReport.service.js";
import { createInterviewReportPdfBuffer, makeInterviewReportFilename } from "../services/interviewReportPdf.service.js";
import {
  getInterviewTutorAnalysisStatus,
  prepareInterviewTutorAnalysis,
} from "../services/interviewTutorAnalysis.service.js";
import {
  TutorBusyError,
  TutorDailyLimitError,
  TutorInsufficientFluxGemsError,
  TutorRateLimitError,
} from "../services/tutorUsage.service.js";

const numberSetting = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

const turnConfig = {
  noSpeechTimeoutMs: numberSetting(process.env.INTERVIEW_NO_SPEECH_TIMEOUT_MS, 15000, 5000, 45000),
  endSilenceMs: numberSetting(process.env.INTERVIEW_END_SILENCE_MS, 7000, 1200, 15000),
  maxAnswerSeconds: numberSetting(process.env.INTERVIEW_MAX_ANSWER_SECONDS, 120, 30, 300),
  warningSeconds: 5,
};

const serializeQuestion = (question) =>
  question?.id
    ? {
        id: question.id,
        sequence: Number(question.sequence || 0),
        text: question.text || "",
        category: question.category || "",
        difficulty: question.difficulty || "medium",
        askedAt: question.askedAt || null,
      }
    : null;

const serializeTurn = (turn) => ({
  submissionId: turn.submissionId,
  questionNumber: Number(turn.questionNumber || 0),
  question: serializeQuestion(turn.question),
  answerTranscript: turn.answerTranscript || "",
  answerDurationMs: Number(turn.answerDurationMs || 0),
  completionReason: turn.completionReason || "",
  submittedAt: turn.submittedAt || null,
});

const serializeInterview = (interview) => ({
  id: interview._id,
  targetRole: interview.targetRole,
  experienceLevel: interview.experienceLevel,
  interviewType: interview.interviewType,
  status: interview.status,
  phase: interview.phase,
  cost: Number(interview.cost || INTERVIEW_COST),
  useLearnerProfile: interview.useLearnerProfile !== false,
  questionCount: Number(interview.questionCount || 0),
  maxQuestions: Number(interview.maxQuestions || INTERVIEW_QUESTION_COUNT),
  currentQuestion: serializeQuestion(interview.currentQuestion),
  transcript: Array.isArray(interview.transcript) ? interview.transcript.map(serializeTurn) : [],
  interviewer: {
    name: interview.interviewer?.name || "Astra",
    voice: interview.interviewer?.voice || "Kore",
  },
  hasResume: Boolean(interview.resume?.fileName),
  resume: interview.resume?.fileName
    ? {
        fileName: interview.resume.fileName,
        mimeType: interview.resume.mimeType,
        sizeBytes: Number(interview.resume.sizeBytes || 0),
      }
    : null,
  profileSnapshot: interview.profileSnapshot || {},
  readinessSnapshot: interview.readinessSnapshot || {},
  startedAt: interview.startedAt,
  lastActivityAt: interview.lastActivityAt || interview.updatedAt,
  completedAt: interview.completedAt || null,
  progressionReward: interview.progressionReward || null,
  reportReady: Boolean(interview.finalReport?.generatedAt),
  overallScore: interview.finalReport?.generatedAt ? Number(interview.finalReport?.overallScore || 0) : null,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
  turnConfig,
});

const serializeReportTurn = (turn) => {
  const answer = String(turn?.answerTranscript || "").trim();
  const words = answer ? answer.split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(Number(turn?.answerDurationMs || 0), 0) / 60000;

  return {
  ...serializeTurn(turn),
  delivery: {
    wordCount: words,
    estimatedWpm: minutes > 0 ? Math.round(words / minutes) : 0,
  },
  evaluation: {
    score: Number(turn?.evaluation?.score || 0),
    relevance: Number(turn?.evaluation?.relevance || 0),
    correctness: Number(turn?.evaluation?.correctness || 0),
    clarity: Number(turn?.evaluation?.clarity || 0),
    completeness: Number(turn?.evaluation?.completeness || 0),
    strengths: Array.isArray(turn?.evaluation?.strengths) ? turn.evaluation.strengths : [],
    improvements: Array.isArray(turn?.evaluation?.improvements) ? turn.evaluation.improvements : [],
    summary: turn?.evaluation?.summary || "",
  },
  };
};

const serializeReport = (interview) => ({
  interview: {
    id: interview._id,
    targetRole: interview.targetRole,
    experienceLevel: interview.experienceLevel,
    interviewType: interview.interviewType,
    useLearnerProfile: interview.useLearnerProfile !== false,
    startedAt: interview.startedAt,
    completedAt: interview.completedAt,
    profileSnapshot: interview.profileSnapshot || {},
    resume: interview.resume?.fileName
      ? { fileName: interview.resume.fileName, mimeType: interview.resume.mimeType, sizeBytes: Number(interview.resume.sizeBytes || 0) }
      : null,
  },
  report: interview.finalReport || null,
  progressionReward: interview.progressionReward || null,
  questions: Array.isArray(interview.transcript) ? interview.transcript.map(serializeReportTurn) : [],
});

const invalidId = (res) =>
  res.status(404).json({ success: false, code: "INTERVIEW_NOT_FOUND", message: "Interview not found." });

const handleInterviewStateError = (error, res) => {
  if (!(error instanceof InterviewStateError)) return false;
  res.status(Number(error.status || 409)).json({ success: false, code: error.code, message: error.message });
  return true;
};

export const runSmartInterviewPreflight = async (req, res) => {
  const probe = typeof req.body?.probe === "string" ? req.body.probe : "";
  if (!probe || probe.length > 64 * 1024) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PREFLIGHT_PROBE",
      message: "Connection preflight payload is invalid.",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      receivedBytes: Buffer.byteLength(probe, "utf8"),
      serverTime: new Date().toISOString(),
    },
  });
};

export const getSmartInterviewEligibility = async (req, res, next) => {
  try {
    const eligibility = await getInterviewEligibility(req.user._id);
    return res.status(200).json({
      success: true,
      data: {
        ...eligibility,
        cost: INTERVIEW_COST,
        questionCount: INTERVIEW_QUESTION_COUNT,
        balance: Number(req.user.fluxGems || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listSmartInterviews = async (req, res, next) => {
  try {
    const interviews = await InterviewSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return res.status(200).json({
      success: true,
      data: { interviews: interviews.map(serializeInterview) },
    });
  } catch (error) {
    next(error);
  }
};

export const getSmartInterview = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);

    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    }).lean();

    if (!interview) return invalidId(res);

    return res.status(200).json({
      success: true,
      data: { interview: serializeInterview(interview) },
    });
  } catch (error) {
    next(error);
  }
};

export const startSmartInterview = async (req, res, next) => {
  const validation = validateInterviewStartInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_INTERVIEW_SETUP",
      message: "Please correct the interview setup details.",
      errors: validation.errors,
    });
  }

  try {
    const result = await beginSmartInterview({
      userId: req.user._id,
      input: validation.values,
      resumeFile: req.file || null,
    });

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "This interview was already started. Opening the existing session."
        : `Smart Interview started. ${INTERVIEW_COST} FluxGems used.`,
      data: {
        interview: serializeInterview(result.interview),
        balance: result.balance,
        charged: !result.duplicate,
      },
    });
  } catch (error) {
    if (error instanceof InterviewEligibilityError) {
      return res.status(403).json({ success: false, code: error.code, message: error.message });
    }
    if (error instanceof InterviewInsufficientFluxGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: { required: error.required, balance: Number(req.user.fluxGems || 0) },
      });
    }
    next(error);
  }
};

export const initializeSmartInterviewSession = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);
    const result = await initializeSmartInterview({
      userId: req.user._id,
      interviewId: req.params.interviewId,
    });
    return res.status(200).json({
      success: true,
      message: result.initialized ? "Astra prepared your first question." : "Interview is ready to continue.",
      data: { interview: serializeInterview(result.interview), initialized: result.initialized },
    });
  } catch (error) {
    if (handleInterviewStateError(error, res)) return;
    next(error);
  }
};

export const streamSmartInterviewQuestionAudio = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);
    const questionId = String(req.query.questionId || "").trim();
    if (!questionId) {
      return res.status(400).json({ success: false, code: "QUESTION_ID_REQUIRED", message: "Question ID is required." });
    }

    const generated = await getSmartInterviewQuestionAudio({
      userId: req.user._id,
      interviewId: req.params.interviewId,
      questionId,
    });

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", generated.wav.length);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.setHeader("X-Interview-Voice", generated.voice);
    res.setHeader("X-Interview-TTS-Ms", String(Math.max(0, Number(generated.durationMs || 0))));
    res.setHeader("X-Interview-Audio-Cache", generated.cacheStatus || "unknown");
    res.setHeader("Server-Timing", `interview-tts;dur=${Math.max(0, Number(generated.durationMs || 0))}`);
    return res.status(200).send(generated.wav);
  } catch (error) {
    if (handleInterviewStateError(error, res)) return;
    next(error);
  }
};

export const getSmartInterviewReport = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);

    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    });

    if (!interview) return invalidId(res);
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_REPORT_NOT_AVAILABLE",
        message: "Complete the interview before opening its report.",
      });
    }

    if (!interview.finalReport?.generatedAt) {
      queueSmartInterviewReport({ userId: req.user._id, interviewId: interview._id });
      return res.status(202).json({
        success: true,
        message: "Astra is preparing your final interview report.",
        data: { ready: false, phase: "report_generating" },
      });
    }

    return res.status(200).json({
      success: true,
      data: { ready: true, ...serializeReport(interview) },
    });
  } catch (error) {
    next(error);
  }
};

export const retrySmartInterviewReport = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);
    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    });
    if (!interview) return invalidId(res);
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_REPORT_NOT_AVAILABLE",
        message: "Complete the interview before opening its report.",
      });
    }
    if (interview.finalReport?.generatedAt) {
      return res.status(200).json({
        success: true,
        message: "Interview report is ready.",
        data: { ready: true, ...serializeReport(interview) },
      });
    }

    queueSmartInterviewReport({ userId: req.user._id, interviewId: interview._id });
    return res.status(202).json({
      success: true,
      message: "Astra is retrying your final interview report in the background.",
      data: { ready: false, phase: "report_generating" },
    });
  } catch (error) {
    next(error);
  }
};

export const getSmartInterviewTutorAnalysisStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);

    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    }).select("_id status");

    if (!interview) return invalidId(res);
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_TUTOR_ANALYSIS_NOT_AVAILABLE",
        message: "Complete the interview before sending its question stack to AI Tutor.",
      });
    }

    const result = await getInterviewTutorAnalysisStatus({
      userId: req.user._id,
      interviewId: interview._id,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: result.status,
        conversationId: result.conversation?._id || null,
        failure: result.failure || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const exportSmartInterviewQuestionsToTutor = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);

    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    });

    if (!interview) return invalidId(res);
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_TUTOR_ANALYSIS_NOT_AVAILABLE",
        message: "Complete the interview before sending its question stack to AI Tutor.",
      });
    }

    const result = await prepareInterviewTutorAnalysis({
      userId: req.user._id,
      interview,
      fallbackBalance: Number(req.user.fluxGems || 0),
    });

    return res.status(result.status === "ready" ? 200 : 202).json({
      success: true,
      message: result.status === "ready"
        ? "Opening your existing AI Tutor interview deep dive."
        : result.existing
          ? "Your interview deep dive is already generating in AI Tutor."
          : "Interview question stack exported. AI Tutor is generating the deep dive in the background.",
      data: {
        status: result.status,
        conversationId: result.conversation?._id || null,
        existing: Boolean(result.existing),
        billing: result.billing || null,
        usage: result.usage || null,
      },
    });
  } catch (error) {
    if (error instanceof TutorInsufficientFluxGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: { required: error.required, balance: Number(req.user.fluxGems || 0) },
      });
    }

    if (error instanceof TutorBusyError) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof TutorRateLimitError) {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        data: { retryAfterMs: error.retryAfterMs },
      });
    }

    if (error instanceof TutorDailyLimitError) {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        data: { limit: error.limit },
      });
    }

    if (error?.code === "INTERVIEW_QUESTION_STACK_EMPTY") {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    next(error);
  }
};

export const downloadSmartInterviewReportPdf = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);
    const interview = await InterviewSession.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
    });
    if (!interview) return invalidId(res);
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_REPORT_NOT_AVAILABLE",
        message: "Complete the interview before downloading its report.",
      });
    }
    if (!interview.finalReport?.generatedAt) {
      queueSmartInterviewReport({ userId: req.user._id, interviewId: interview._id });
      return res.status(409).json({
        success: false,
        code: "INTERVIEW_REPORT_GENERATING",
        message: "Your report is still being prepared. Try the PDF again in a moment.",
      });
    }

    const pdfBuffer = await createInterviewReportPdfBuffer(interview.toObject());
    const filename = makeInterviewReportFilename(interview);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const submitSmartInterviewAnswerController = async (req, res, next) => {
  const validation = validateInterviewAnswerInput(req.body, Boolean(req.file));
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_INTERVIEW_ANSWER",
      message: "That interview answer could not be submitted.",
      errors: validation.errors,
    });
  }

  try {
    if (!mongoose.isValidObjectId(req.params.interviewId)) return invalidId(res);

    const result = await submitSmartInterviewAnswer({
      userId: req.user._id,
      interviewId: req.params.interviewId,
      input: validation.values,
      answerFile: req.file || null,
    });

    return res.status(200).json({
      success: true,
      message: result.completed
        ? "Interview questions complete."
        : result.duplicate
          ? "That answer was already processed. Continuing from the saved interview state."
          : "Answer processed. Astra prepared the next question.",
      data: {
        interview: serializeInterview(result.interview),
        turn: serializeTurn(result.turn),
        duplicate: result.duplicate,
        completed: result.completed,
        progression: result.progression || result.interview?.progressionReward || null,
      },
    });
  } catch (error) {
    if (handleInterviewStateError(error, res)) return;
    next(error);
  }
};
