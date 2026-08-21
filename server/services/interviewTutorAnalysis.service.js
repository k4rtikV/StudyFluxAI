import LearningProfile from "../models/LearningProfile.js";
import TutorConversation from "../models/TutorConversation.js";

import { queueLeaderboardRefresh } from "./leaderboard.service.js";
import { generateTutorReply } from "./tutorGemini.service.js";
import {
  completeTutorQuestion,
  failTutorQuestion,
  getTutorUsageStatus,
  reserveTutorQuestion,
} from "./tutorUsage.service.js";

const buildProfileSnapshot = (profile) => ({
  educationLevel: profile?.educationLevel || "",
  institutionType: profile?.institutionType || "",
  institutionState: profile?.institutionState || "",
  institutionId: profile?.institutionId || "",
  institutionCategory: profile?.institutionCategory || "",
  institutionSector: profile?.institutionSector || "",
  institutionKey: profile?.institutionKey || "",
  institutionName: profile?.institutionName || "",
  programKey: profile?.programKey || "",
  program: profile?.program || "",
  streamKey: profile?.streamKey || "",
  stream: profile?.stream || "",
});

const clampText = (value, max = 1400) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trim()}…`;
};

const buildQuestionStack = (interview) => {
  const turns = Array.isArray(interview?.transcript) ? interview.transcript : [];
  return turns
    .map((turn, index) => {
      const question = turn?.question || {};
      const text = clampText(question.text, 1400);
      if (!text) return null;
      return {
        number: Number(turn?.questionNumber || question.sequence || index + 1),
        category: clampText(question.category || "General", 80),
        difficulty: clampText(question.difficulty || "medium", 40),
        text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
};

const buildAnalysisPrompt = (interview, questions) => {
  const stack = questions
    .map(
      (question) =>
        `${question.number}. [${question.category} · ${question.difficulty}] ${question.text}`,
    )
    .join("\n");

  return `I completed a StudyFluxAI Smart Interview and want a deep study brief for the full question stack.\n\nINTERVIEW CONTEXT\nTarget role: ${clampText(interview.targetRole, 120)}\nExperience level: ${clampText(interview.experienceLevel, 40)}\nInterview type: ${clampText(interview.interviewType, 40)}\n\nQUESTION STACK\n${stack}\n\nCreate a detailed, interview-preparation brief for EVERY question above. Preserve the question numbering and cover all questions in one response. For each question include:\n- What the interviewer is testing and the concepts behind it.\n- A strong, in-depth answer a well-prepared candidate could give.\n- Important trade-offs, edge cases, common mistakes, or follow-up angles where relevant.\n- A short memory hook / key points to revise.\n\nFor project-related questions, use a GENERAL CONTEXTUAL and architectural view based only on the technologies or scenario named in the question. Do not invent exact details about my implementation, codebase, metrics, or decisions that were not supplied. Clearly frame project-specific examples as examples a candidate could adapt to their real project.\n\nFocus on learning the questions and strong answers rather than grading my recorded responses. Keep the result detailed but compact enough that every question receives useful coverage.`;
};

const findExistingAnalysisConversation = (userId, interviewId) =>
  TutorConversation.findOne({
    user: userId,
    sourceInterview: interviewId,
    archivedAt: null,
  });

const createAnalysisConversation = async ({ userId, interview, academicContext }) => {
  const title = `Interview deep dive · ${clampText(interview.targetRole, 72)}`.slice(0, 100);

  try {
    return await TutorConversation.create({
      user: userId,
      title,
      academicContext,
      contextTitle: `Smart Interview · ${clampText(interview.targetRole, 140)}`,
      sourceInterview: interview._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findExistingAnalysisConversation(userId, interview._id);
      if (existing) return existing;
    }
    throw error;
  }
};

export class InterviewTutorAnalysisBusyError extends Error {
  constructor() {
    super("This interview is already being prepared in AI Tutor.");
    this.name = "InterviewTutorAnalysisBusyError";
    this.code = "INTERVIEW_TUTOR_ANALYSIS_BUSY";
  }
}

export class InterviewTutorAnalysisGenerationError extends Error {
  constructor({ message, refunded = false, balance = null, causeCode = "" } = {}) {
    super(message || "AI Tutor could not prepare the interview deep dive.");
    this.name = "InterviewTutorAnalysisGenerationError";
    this.code = "INTERVIEW_TUTOR_ANALYSIS_FAILED";
    this.causeCode = causeCode;
    this.refunded = Boolean(refunded);
    this.balance = balance;
  }
}

export const createInterviewTutorAnalysis = async ({
  userId,
  interview,
  fallbackBalance = 0,
}) => {
  const questions = buildQuestionStack(interview);
  if (!questions.length) {
    const error = new Error("This interview does not contain a saved question stack to analyze.");
    error.code = "INTERVIEW_QUESTION_STACK_EMPTY";
    throw error;
  }

  let conversation = await findExistingAnalysisConversation(userId, interview._id);

  if (conversation?.successfulQuestionCount > 0) {
    return {
      existing: true,
      conversation,
      billing: {
        isFree: null,
        charged: 0,
        balance: Number(fallbackBalance || 0),
      },
      usage: await getTutorUsageStatus(userId),
    };
  }

  if (conversation?.isGenerating) {
    throw new InterviewTutorAnalysisBusyError();
  }

  const profile = await LearningProfile.findOne({ user: userId }).lean();
  const academicContext = buildProfileSnapshot(profile || interview.profileSnapshot || {});

  if (!conversation) {
    conversation = await createAnalysisConversation({
      userId,
      interview,
      academicContext,
    });
  }

  if (conversation.isGenerating) {
    throw new InterviewTutorAnalysisBusyError();
  }

  const prompt = buildAnalysisPrompt(interview, questions);
  let reservation;

  reservation = await reserveTutorQuestion({
    userId,
    conversationId: conversation._id,
    question: prompt,
  });

  try {
    const generation = await generateTutorReply({
      academicContext: conversation.academicContext,
      studySession: null,
      history: [],
      question: prompt,
    });

    const assistantMessage = await completeTutorQuestion({
      userId,
      conversationId: conversation._id,
      reservation,
      reply: generation.text,
      modelUsed: generation.modelUsed,
      fallbackUsed: generation.fallbackUsed,
    });

    const title = `Interview deep dive · ${clampText(interview.targetRole, 72)}`.slice(0, 100);
    conversation = await TutorConversation.findOneAndUpdate(
      { _id: conversation._id, user: userId },
      { $set: { title, contextTitle: `Smart Interview · ${clampText(interview.targetRole, 140)}` } },
      { new: true },
    );

    const usage = await getTutorUsageStatus(userId);
    queueLeaderboardRefresh(userId);

    return {
      existing: false,
      conversation,
      assistantMessage,
      billing: {
        isFree: reservation.isFree,
        charged: Number(reservation.cost || 0),
        balance:
          reservation.balance == null
            ? Number(fallbackBalance || 0)
            : Number(reservation.balance || 0),
      },
      usage,
    };
  } catch (generationError) {
    let failure = {
      refunded: false,
      balance: reservation.balance,
    };

    try {
      failure = await failTutorQuestion({
        userId,
        conversationId: conversation._id,
        reservation,
        failureCode: generationError.code || "INTERVIEW_TUTOR_ANALYSIS_GENERATION_FAILED",
        failureMessage: generationError.message || "Interview Tutor analysis failed.",
      });
    } catch (rollbackError) {
      console.error("CRITICAL: Interview Tutor analysis rollback/refund failed:", rollbackError);
    }

    throw new InterviewTutorAnalysisGenerationError({
      message: reservation.isFree
        ? "AI Tutor could not prepare the interview deep dive, so your free Tutor request was restored. Please try again."
        : failure.refunded
          ? `AI Tutor could not prepare the interview deep dive, so your ${reservation.cost} FluxGems were returned. Please try again.`
          : "AI Tutor could not prepare the interview deep dive. Please try again.",
      refunded: failure.refunded,
      balance: failure.balance,
      causeCode: generationError.code || "",
    });
  }
};
