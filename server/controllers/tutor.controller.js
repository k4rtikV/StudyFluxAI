import { safeErrorDetails } from "../utils/safeError.js";
import mongoose from "mongoose";

import { getNumberEnv } from "../config/env.js";
import LearningProfile from "../models/LearningProfile.js";
import StudySession from "../models/StudySession.js";
import TutorConversation from "../models/TutorConversation.js";
import TutorMessage from "../models/TutorMessage.js";

import { generateTutorReply } from "../services/tutorGemini.service.js";
import {
  extractTutorQuiz,
  looksLikeTutorQuiz,
  persistTutorQuizConversion,
  TUTOR_QUIZ_CONVERSION_COST,
  TutorQuizConversionError,
  TutorQuizConversionInsufficientGemsError,
} from "../services/tutorQuizConversion.service.js";
import { queueLeaderboardRefresh } from "../services/leaderboard.service.js";
import {
  completeTutorQuestion,
  failTutorQuestion,
  getTutorUsageStatus,
  reserveTutorQuestion,
  TutorBusyError,
  TutorDailyLimitError,
  TutorInsufficientFluxGemsError,
  TutorRateLimitError,
} from "../services/tutorUsage.service.js";

const MAX_QUESTION_LENGTH = getNumberEnv("TUTOR_QUESTION_MAX_LENGTH", 2000);

const getHistoryMessageLimit = () =>
  getNumberEnv("TUTOR_HISTORY_MESSAGES", 12);

const buildProfileSnapshot = (profile) => ({
  educationLevel: profile.educationLevel || "",
  institutionType: profile.institutionType || "",
  institutionState: profile.institutionState || "",
  institutionId: profile.institutionId || "",
  institutionCategory: profile.institutionCategory || "",
  institutionSector: profile.institutionSector || "",
  institutionKey: profile.institutionKey || "",
  institutionName: profile.institutionName || "",
  programKey: profile.programKey || "",
  program: profile.program || "",
  streamKey: profile.streamKey || "",
  stream: profile.stream || "",
});

const getStudySessionTitle = (studySession) =>
  studySession?.output?.sessionTitle ||
  studySession?.topic ||
  studySession?.sourceFile?.fileName ||
  "";

const serializeMessage = (message) => ({
  id: message._id,
  role: message.role,
  content: message.content,
  sequence: Number(message.sequence || 0),
  status: message.status,
  billing:
    message.role === "user"
      ? {
          isFree: Boolean(message.billing?.isFree),
          cost: Number(message.billing?.cost || 0),
        }
      : undefined,
  modelUsed: message.role === "assistant"
    ? message.modelUsed || ""
    : undefined,
  fallbackUsed:
    message.role === "assistant"
      ? Boolean(message.fallbackUsed)
      : undefined,
  quizConversion:
    message.role === "assistant"
      ? {
          eligible:
            Boolean(message.convertedStudySession) ||
            looksLikeTutorQuiz(message.content),
          cost: TUTOR_QUIZ_CONVERSION_COST,
          studySessionId: message.convertedStudySession || null,
          convertedAt: message.convertedAt || null,
        }
      : undefined,
  createdAt: message.createdAt,
  completedAt: message.completedAt,
});

const serializeConversation = (conversation) => ({
  id: conversation._id,
  title: conversation.title || "Tutor conversation",
  academicContext: conversation.academicContext || null,
  contextStudySession: conversation.contextStudySession
    ? {
        id:
          conversation.contextStudySession._id ||
          conversation.contextStudySession,
        title:
          conversation.contextStudySession.output?.sessionTitle ||
          conversation.contextStudySession.topic ||
          conversation.contextTitle ||
          "Saved learning session",
        generationType:
          conversation.contextStudySession.generationType || "",
      }
    : null,
  contextTitle: conversation.contextTitle || "",
  sourceInterviewId: conversation.sourceInterview?._id || conversation.sourceInterview || null,
  sourceInterviewUsesLearnerProfile: conversation.sourceInterview
    ? conversation.sourceInterviewUsesLearnerProfile !== false
    : null,
  messageCount: Number(conversation.messageCount || 0),
  successfulQuestionCount: Number(
    conversation.successfulQuestionCount || 0,
  ),
  isGenerating: Boolean(conversation.isGenerating),
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const findOwnedConversation = async (userId, conversationId) => {
  if (!mongoose.isValidObjectId(conversationId)) {
    return null;
  }

  return TutorConversation.findOne({
    _id: conversationId,
    user: userId,
    archivedAt: null,
  });
};

export const getTutorUsage = async (req, res, next) => {
  try {
    const usage = await getTutorUsageStatus(req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        usage,
        balance: Number(req.user.fluxGems || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listTutorConversations = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 40);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 40, 1),
      80,
    );

    const conversations = await TutorConversation.find({
      user: req.user._id,
      archivedAt: null,
      $or: [
        { messageCount: { $gt: 0 } },
        { isGenerating: true },
        { sourceInterview: { $ne: null } },
      ],
    })
      .populate({
        path: "contextStudySession",
        select: "generationType topic output.sessionTitle",
      })
      .sort({
        lastMessageAt: -1,
        updatedAt: -1,
      })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        conversations: conversations.map(serializeConversation),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createTutorConversation = async (req, res, next) => {
  try {
    if (!req.user.learningProfileCompleted) {
      return res.status(403).json({
        success: false,
        code: "LEARNING_PROFILE_REQUIRED",
        message:
          "Complete your learning profile before using AI Tutor.",
      });
    }

    const profile = await LearningProfile.findOne({
      user: req.user._id,
    }).lean();

    if (!profile) {
      return res.status(403).json({
        success: false,
        code: "LEARNING_PROFILE_REQUIRED",
        message:
          "Complete your learning profile before using AI Tutor.",
      });
    }

    const requestedStudySessionId = String(
      req.body?.studySessionId || "",
    ).trim();

    let studySession = null;

    if (requestedStudySessionId) {
      if (!mongoose.isValidObjectId(requestedStudySessionId)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_TUTOR_CONTEXT",
          message: "Choose a valid Study Library item.",
        });
      }

      studySession = await StudySession.findOne({
        _id: requestedStudySessionId,
        user: req.user._id,
        status: "completed",
      })
        .select(
          "generationType topic sourceFile output.sessionTitle output.shortDescription",
        )
        .lean();

      if (!studySession) {
        return res.status(404).json({
          success: false,
          code: "TUTOR_CONTEXT_NOT_FOUND",
          message:
            "The selected Study Library item could not be found.",
        });
      }
    }

    const contextTitle = getStudySessionTitle(studySession);

    const conversation = await TutorConversation.create({
      user: req.user._id,
      title: contextTitle
        ? `Tutor: ${contextTitle}`.slice(0, 100)
        : "New tutor chat",
      academicContext: buildProfileSnapshot(profile),
      contextStudySession: studySession?._id || null,
      contextTitle,
    });

    return res.status(201).json({
      success: true,
      message: "Tutor conversation created.",
      data: {
        conversation: serializeConversation(conversation),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTutorConversation = async (req, res, next) => {
  try {
    const conversation = await findOwnedConversation(
      req.user._id,
      req.params.conversationId,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_CONVERSATION_NOT_FOUND",
        message: "Tutor conversation not found.",
      });
    }

    await conversation.populate({
      path: "contextStudySession",
      select: "generationType topic output.sessionTitle",
    });

    const messages = await TutorMessage.find({
      user: req.user._id,
      conversation: conversation._id,
      status: "completed",
    })
      .sort({ sequence: 1 })
      .lean();

    let generationFailure = null;
    if (conversation.sourceInterview && !conversation.isGenerating && Number(conversation.successfulQuestionCount || 0) === 0) {
      const failedMessage = await TutorMessage.findOne({
        user: req.user._id,
        conversation: conversation._id,
        role: "user",
        status: "failed",
      })
        .sort({ createdAt: -1 })
        .lean();

      if (failedMessage) {
        generationFailure = {
          code: failedMessage.failureCode || "INTERVIEW_TUTOR_ANALYSIS_FAILED",
          message: failedMessage.failureMessage || "The interview deep dive could not be generated.",
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        conversation: serializeConversation(conversation),
        messages: messages.map(serializeMessage),
        generationFailure,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const archiveTutorConversation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_CONVERSATION_NOT_FOUND",
        message: "Tutor conversation not found.",
      });
    }

    const conversation = await TutorConversation.findOneAndUpdate(
      {
        _id: req.params.conversationId,
        user: req.user._id,
        archivedAt: null,
        isGenerating: false,
      },
      {
        $set: {
          archivedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!conversation) {
      return res.status(409).json({
        success: false,
        code: "TUTOR_CONVERSATION_BUSY_OR_NOT_FOUND",
        message:
          "This Tutor conversation could not be removed right now.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tutor conversation removed from history.",
    });
  } catch (error) {
    next(error);
  }
};

export const convertTutorQuizToStudyLibrary = async (req, res, next) => {
  try {
    const conversation = await findOwnedConversation(
      req.user._id,
      req.params.conversationId,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_CONVERSATION_NOT_FOUND",
        message: "Tutor conversation not found.",
      });
    }

    const assistantMessageId = String(
      req.body?.assistantMessageId || "",
    ).trim();

    if (!mongoose.isValidObjectId(assistantMessageId)) {
      return res.status(400).json({
        success: false,
        code: "TUTOR_QUIZ_MESSAGE_REQUIRED",
        message: "Choose the Tutor quiz you want to save.",
      });
    }

    const assistantMessage = await TutorMessage.findOne({
      _id: assistantMessageId,
      user: req.user._id,
      conversation: conversation._id,
      role: "assistant",
      status: "completed",
    });

    if (!assistantMessage) {
      return res.status(404).json({
        success: false,
        code: "TUTOR_QUIZ_MESSAGE_NOT_FOUND",
        message: "That Tutor reply could not be found.",
      });
    }

    if (assistantMessage.convertedStudySession) {
      const existing = await StudySession.findOne({
        _id: assistantMessage.convertedStudySession,
        user: req.user._id,
      }).lean();

      if (existing) {
        return res.status(200).json({
          success: true,
          message: "This Tutor quiz is already saved in Study Library.",
          data: {
            studySession: {
              id: existing._id,
              title:
                existing.output?.sessionTitle ||
                existing.topic ||
                "Tutor quiz",
              generationType: "quiz",
              origin: existing.origin || "ai_tutor",
            },
            balance: Number(req.user.fluxGems || 0),
            charged: 0,
            alreadyConverted: true,
          },
        });
      }
    }

    if (!looksLikeTutorQuiz(assistantMessage.content)) {
      return res.status(400).json({
        success: false,
        code: "TUTOR_QUIZ_NOT_FOUND",
        message: "I couldn't find a complete quiz in that Tutor reply.",
      });
    }

    let contextStudySession = null;
    if (conversation.contextStudySession) {
      contextStudySession = await StudySession.findOne({
        _id: conversation.contextStudySession,
        user: req.user._id,
        status: "completed",
      })
        .select(
          "output.quiz quizProgressionSource generationType origin",
        )
        .lean();
    }

    // Extraction/validation happens before the wallet transaction. The 25 FG
    // charge is therefore committed only if a valid Study Library quiz can be
    // persisted successfully.
    const extracted = await extractTutorQuiz({
      assistantContent: assistantMessage.content,
      academicContext: conversation.academicContext || {},
    });

    const persisted = await persistTutorQuizConversion({
      userId: req.user._id,
      conversation,
      assistantMessage,
      extracted,
      contextStudySession,
    });

    return res.status(persisted.alreadyConverted ? 200 : 201).json({
      success: true,
      message: persisted.alreadyConverted
        ? "This Tutor quiz is already saved in Study Library."
        : "Tutor quiz saved to Study Library.",
      data: {
        studySession: {
          id: persisted.studySession._id,
          title:
            persisted.studySession.output?.sessionTitle ||
            persisted.studySession.topic ||
            "Tutor quiz",
          generationType: "quiz",
          origin: "ai_tutor",
          sourceKind:
            persisted.studySession.tutorProvenance?.sourceKind ||
            "tutor_generated",
        },
        balance: persisted.balance,
        charged: persisted.alreadyConverted
          ? 0
          : TUTOR_QUIZ_CONVERSION_COST,
        alreadyConverted: persisted.alreadyConverted,
      },
    });
  } catch (error) {
    if (error instanceof TutorQuizConversionInsufficientGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          required: error.required,
          balance: Number(req.user.fluxGems || 0),
        },
      });
    }

    if (error instanceof TutorQuizConversionError) {
      return res.status(error.status || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    next(error);
  }
};

export const sendTutorMessage = async (req, res, next) => {
  const question = String(req.body?.message || "")
    .trim()
    .replace(/\r\n/g, "\n");

  if (!question) {
    return res.status(400).json({
      success: false,
      code: "TUTOR_MESSAGE_REQUIRED",
      message: "Enter a question for AI Tutor.",
    });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      success: false,
      code: "TUTOR_MESSAGE_TOO_LONG",
      message: `Tutor questions can be up to ${MAX_QUESTION_LENGTH} characters.`,
    });
  }

  const conversation = await findOwnedConversation(
    req.user._id,
    req.params.conversationId,
  );

  if (!conversation) {
    return res.status(404).json({
      success: false,
      code: "TUTOR_CONVERSATION_NOT_FOUND",
      message: "Tutor conversation not found.",
    });
  }

  let reservation;

  try {
    reservation = await reserveTutorQuestion({
      userId: req.user._id,
      conversationId: conversation._id,
      question,
    });
  } catch (error) {
    if (error instanceof TutorInsufficientFluxGemsError) {
      return res.status(402).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          required: error.required,
          balance: Number(req.user.fluxGems || 0),
        },
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
        data: {
          retryAfterMs: error.retryAfterMs,
        },
      });
    }

    if (error instanceof TutorDailyLimitError) {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: error.message,
        data: {
          limit: error.limit,
        },
      });
    }

    if (error?.code === "TUTOR_CONVERSATION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  }

  try {
    const historyLimit = getHistoryMessageLimit();

    const priorMessagesDescending = await TutorMessage.find({
      user: req.user._id,
      conversation: conversation._id,
      status: "completed",
    })
      .sort({ sequence: -1 })
      .limit(historyLimit)
      .lean();

    const history = priorMessagesDescending.reverse();

    let studySession = null;

    if (conversation.contextStudySession) {
      studySession = await StudySession.findOne({
        _id: conversation.contextStudySession,
        user: req.user._id,
        status: "completed",
      })
        .select(
          "generationType topic sourceFile output academicContext",
        )
        .lean();
    }

    const generation = await generateTutorReply({
      academicContext: conversation.academicContext,
      studySession,
      history,
      question,
    });

    const assistantMessage = await completeTutorQuestion({
      userId: req.user._id,
      conversationId: conversation._id,
      reservation,
      reply: generation.text,
      modelUsed: generation.modelUsed,
      fallbackUsed: generation.fallbackUsed,
    });

    const usage = await getTutorUsageStatus(req.user._id);

    queueLeaderboardRefresh(req.user._id);

    return res.status(201).json({
      success: true,
      message: generation.fallbackUsed
        ? "AI Tutor replied using the fallback Gemini model."
        : "AI Tutor replied successfully.",
      data: {
        userMessage: {
          id: reservation.userMessageId,
          role: "user",
          content: question,
          sequence: reservation.userSequence,
          status: "completed",
          billing: {
            isFree: reservation.isFree,
            cost: reservation.cost,
          },
        },
        assistantMessage: serializeMessage(assistantMessage),
        billing: {
          isFree: reservation.isFree,
          charged: reservation.cost,
          balance:
            reservation.balance ??
            Number(req.user.fluxGems || 0),
        },
        usage,
      },
    });
  } catch (generationError) {
    let failure = {
      refunded: false,
      balance: reservation.balance,
    };

    try {
      failure = await failTutorQuestion({
        userId: req.user._id,
        conversationId: conversation._id,
        reservation,
        failureCode:
          generationError.code || "AI_TUTOR_FAILED",
        failureMessage:
          generationError.message || "AI Tutor failed.",
      });
    } catch (refundError) {
      console.error(
        "CRITICAL: Tutor usage rollback/refund failed:",
        safeErrorDetails(refundError),
      );
    }

    return res.status(503).json({
      success: false,
      code:
        generationError.code || "AI_TUTOR_FAILED",
      message: reservation.isFree
        ? "AI Tutor could not answer, so your free question was not consumed. Please try again."
        : failure.refunded
          ? `AI Tutor could not answer, so your ${reservation.cost} FluxGems were returned. Please try again.`
          : "AI Tutor could not answer. Please try again.",
      data: {
        refunded: failure.refunded,
        balance: failure.balance,
      },
    });
  }
};