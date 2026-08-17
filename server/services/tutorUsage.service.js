import mongoose from "mongoose";

import FluxGemTransaction from "../models/FluxGemTransaction.js";
import TutorConversation from "../models/TutorConversation.js";
import TutorDailyUsage from "../models/TutorDailyUsage.js";
import TutorMessage from "../models/TutorMessage.js";
import User from "../models/User.js";

const getFreeLimit = () =>
  Math.max(
    Number(process.env.TUTOR_FREE_QUESTIONS_PER_DAY || 5),
    0,
  );

const getPaidCost = () =>
  Math.max(
    Number(process.env.TUTOR_PAID_QUESTION_COST || 5),
    0,
  );

const getDailyHardLimit = () =>
  Math.max(
    Number(process.env.TUTOR_DAILY_HARD_LIMIT || 100),
    getFreeLimit(),
  );

const getRateLimitMs = () =>
  Math.max(
    Number(process.env.TUTOR_RATE_LIMIT_MS || 1500),
    0,
  );

const getStaleLockMs = () =>
  Math.max(
    Number(process.env.TUTOR_STALE_LOCK_MS || 120000),
    30000,
  );

export const getTutorDayKey = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export class TutorBusyError extends Error {
  constructor(message = "Your AI Tutor is already answering another question.") {
    super(message);
    this.name = "TutorBusyError";
    this.code = "TUTOR_BUSY";
  }
}

export class TutorRateLimitError extends Error {
  constructor(retryAfterMs = 1500) {
    super("You're sending Tutor questions too quickly. Please wait a moment.");
    this.name = "TutorRateLimitError";
    this.code = "TUTOR_RATE_LIMIT";
    this.retryAfterMs = retryAfterMs;
  }
}

export class TutorDailyLimitError extends Error {
  constructor(limit) {
    super(`You've reached today's Tutor request limit of ${limit}.`);
    this.name = "TutorDailyLimitError";
    this.code = "TUTOR_DAILY_LIMIT";
    this.limit = limit;
  }
}

export class TutorInsufficientFluxGemsError extends Error {
  constructor(required) {
    super(`You need ${required} FluxGems for the next AI Tutor question.`);
    this.name = "TutorInsufficientFluxGemsError";
    this.code = "TUTOR_INSUFFICIENT_FLUXGEMS";
    this.required = required;
  }
}

const ensureDailyUsage = async (userId, dayKey) => {
  try {
    return await TutorDailyUsage.findOneAndUpdate(
      {
        user: userId,
        dayKey,
      },
      {
        $setOnInsert: {
          user: userId,
          dayKey,
          freeQuestionsUsed: 0,
          paidQuestions: 0,
          successfulQuestions: 0,
          failedQuestions: 0,
          attemptedQuestions: 0,
          isGenerating: false,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  } catch (error) {
    if (error?.code === 11000) {
      return TutorDailyUsage.findOne({
        user: userId,
        dayKey,
      });
    }

    throw error;
  }
};

const truncateTitle = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");

  if (text.length <= 72) {
    return text || "Tutor conversation";
  }

  return `${text.slice(0, 69).trim()}...`;
};


export const recoverStaleTutorReservation = async (userId) => {
  const staleBefore = new Date(Date.now() - getStaleLockMs());

  const staleMessage = await TutorMessage.findOne({
    user: userId,
    role: "user",
    status: "processing",
    createdAt: { $lte: staleBefore },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!staleMessage) {
    await TutorDailyUsage.updateMany(
      {
        user: userId,
        isGenerating: true,
        lastRequestAt: { $lte: staleBefore },
      },
      {
        $set: {
          isGenerating: false,
        },
      },
    );

    await TutorConversation.updateMany(
      {
        user: userId,
        isGenerating: true,
        updatedAt: { $lte: staleBefore },
      },
      {
        $set: {
          isGenerating: false,
        },
      },
    );

    return {
      recovered: false,
    };
  }

  const reservation = {
    userMessageId: staleMessage._id,
    dayKey:
      staleMessage.billing?.dayKey ||
      getTutorDayKey(staleMessage.createdAt),
    isFree: Boolean(staleMessage.billing?.isFree),
    cost: Number(staleMessage.billing?.cost || 0),
    balance: null,
  };

  const result = await failTutorQuestion({
    userId,
    conversationId: staleMessage.conversation,
    reservation,
    failureCode: "TUTOR_STALE_REQUEST_RECOVERED",
    failureMessage:
      "A Tutor request was interrupted before completion and was automatically rolled back.",
  });

  return {
    recovered: true,
    ...result,
  };
};

export const getTutorUsageStatus = async (userId) => {
  await recoverStaleTutorReservation(userId);

  const dayKey = getTutorDayKey();
  const usage = await ensureDailyUsage(userId, dayKey);

  const freeLimit = getFreeLimit();
  const paidCost = getPaidCost();

  return {
    dayKey,
    freeLimit,
    freeUsed: Number(usage?.freeQuestionsUsed || 0),
    freeRemaining: Math.max(
      freeLimit - Number(usage?.freeQuestionsUsed || 0),
      0,
    ),
    paidQuestions: Number(usage?.paidQuestions || 0),
    successfulQuestions: Number(usage?.successfulQuestions || 0),
    paidQuestionCost: paidCost,
    dailyHardLimit: getDailyHardLimit(),
    isGenerating: Boolean(usage?.isGenerating),
  };
};

export const reserveTutorQuestion = async ({
  userId,
  conversationId,
  question,
}) => {
  await recoverStaleTutorReservation(userId);

  const dayKey = getTutorDayKey();
  const usageDoc = await ensureDailyUsage(userId, dayKey);
  const mongoSession = await mongoose.startSession();

  try {
    let reservation = null;

    await mongoSession.withTransaction(async () => {
      const now = new Date();
      const usage = await TutorDailyUsage.findById(
        usageDoc._id,
      ).session(mongoSession);

      if (!usage) {
        throw new Error("Tutor daily usage could not be initialized.");
      }

      if (usage.isGenerating) {
        throw new TutorBusyError();
      }

      const hardLimit = getDailyHardLimit();

      if (Number(usage.attemptedQuestions || 0) >= hardLimit) {
        throw new TutorDailyLimitError(hardLimit);
      }

      const rateLimitMs = getRateLimitMs();
      const elapsed = usage.lastRequestAt
        ? now.getTime() - usage.lastRequestAt.getTime()
        : Number.POSITIVE_INFINITY;

      if (rateLimitMs > 0 && elapsed < rateLimitMs) {
        throw new TutorRateLimitError(rateLimitMs - elapsed);
      }

      const freeLimit = getFreeLimit();
      const isFree =
        Number(usage.freeQuestionsUsed || 0) < freeLimit;
      const cost = isFree ? 0 : getPaidCost();

      const conversation = await TutorConversation.findOneAndUpdate(
        {
          _id: conversationId,
          user: userId,
          archivedAt: null,
          isGenerating: false,
        },
        {
          $set: {
            isGenerating: true,
            ...(Number(usage.successfulQuestions || 0) === 0
              ? {}
              : {}),
          },
          $inc: {
            nextSequence: 2,
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!conversation) {
        const existing = await TutorConversation.findOne({
          _id: conversationId,
          user: userId,
          archivedAt: null,
        }).session(mongoSession);

        if (existing?.isGenerating) {
          throw new TutorBusyError(
            "This Tutor conversation is already generating a reply.",
          );
        }

        const error = new Error("Tutor conversation not found.");
        error.code = "TUTOR_CONVERSATION_NOT_FOUND";
        throw error;
      }

      let updatedUser = null;

      if (cost > 0) {
        updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,
            fluxGems: { $gte: cost },
            isActive: true,
          },
          {
            $inc: {
              fluxGems: -cost,
            },
          },
          {
            new: true,
            session: mongoSession,
          },
        );

        if (!updatedUser) {
          throw new TutorInsufficientFluxGemsError(cost);
        }
      }

      usage.isGenerating = true;
      usage.lastRequestAt = now;
      usage.attemptedQuestions =
        Number(usage.attemptedQuestions || 0) + 1;

      if (isFree) {
        usage.freeQuestionsUsed =
          Number(usage.freeQuestionsUsed || 0) + 1;
      } else {
        usage.paidQuestions =
          Number(usage.paidQuestions || 0) + 1;
      }

      await usage.save({ session: mongoSession });

      const userSequence = conversation.nextSequence - 1;
      const assistantSequence = conversation.nextSequence;

      const [userMessage] = await TutorMessage.create(
        [
          {
            user: userId,
            conversation: conversationId,
            role: "user",
            content: question,
            sequence: userSequence,
            status: "processing",
            billing: {
              isFree,
              cost,
              dayKey,
            },
          },
        ],
        {
          session: mongoSession,
        },
      );

      if (cost > 0) {
        await FluxGemTransaction.create(
          [
            {
              user: userId,
              type: "spend",
              amount: -cost,
              balanceAfter: updatedUser.fluxGems,
              reason: "ai_tutor",
              tutorConversation: conversationId,
              tutorMessage: userMessage._id,
              metadata: {
                questionCost: cost,
                dayKey,
              },
            },
          ],
          {
            session: mongoSession,
          },
        );
      }

      if (Number(conversation.messageCount || 0) === 0) {
        conversation.title = truncateTitle(question);
        await conversation.save({ session: mongoSession });
      }

      reservation = {
        dayKey,
        isFree,
        cost,
        balance:
          cost > 0
            ? Number(updatedUser.fluxGems || 0)
            : null,
        userMessageId: userMessage._id,
        userSequence,
        assistantSequence,
      };
    });

    return reservation;
  } finally {
    await mongoSession.endSession();
  }
};

export const completeTutorQuestion = async ({
  userId,
  conversationId,
  reservation,
  reply,
  modelUsed,
  fallbackUsed,
}) => {
  const mongoSession = await mongoose.startSession();

  try {
    let assistantMessage = null;

    await mongoSession.withTransaction(async () => {
      const now = new Date();

      const userMessage = await TutorMessage.findOneAndUpdate(
        {
          _id: reservation.userMessageId,
          user: userId,
          conversation: conversationId,
          status: "processing",
        },
        {
          $set: {
            status: "completed",
            completedAt: now,
            failureCode: "",
            failureMessage: "",
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!userMessage) {
        throw new Error("Tutor question reservation could not be completed.");
      }

      [assistantMessage] = await TutorMessage.create(
        [
          {
            user: userId,
            conversation: conversationId,
            role: "assistant",
            content: reply,
            sequence: reservation.assistantSequence,
            status: "completed",
            modelUsed,
            fallbackUsed,
            completedAt: now,
          },
        ],
        {
          session: mongoSession,
        },
      );

      await TutorConversation.findOneAndUpdate(
        {
          _id: conversationId,
          user: userId,
        },
        {
          $set: {
            isGenerating: false,
            lastMessageAt: now,
            lastModelUsed: modelUsed || "",
            fallbackUsed: Boolean(fallbackUsed),
          },
          $inc: {
            messageCount: 2,
            successfulQuestionCount: 1,
          },
        },
        {
          session: mongoSession,
        },
      );

      await TutorDailyUsage.findOneAndUpdate(
        {
          user: userId,
          dayKey: reservation.dayKey,
        },
        {
          $set: {
            isGenerating: false,
          },
          $inc: {
            successfulQuestions: 1,
          },
        },
        {
          session: mongoSession,
        },
      );
    });

    return assistantMessage;
  } finally {
    await mongoSession.endSession();
  }
};

export const failTutorQuestion = async ({
  userId,
  conversationId,
  reservation,
  failureCode,
  failureMessage,
}) => {
  const mongoSession = await mongoose.startSession();

  try {
    let balance = reservation.balance;
    let refunded = false;

    await mongoSession.withTransaction(async () => {
      const failedMessage = await TutorMessage.findOneAndUpdate(
        {
          _id: reservation.userMessageId,
          user: userId,
          conversation: conversationId,
          status: "processing",
        },
        {
          $set: {
            status: "failed",
            failureCode: String(
              failureCode || "AI_TUTOR_FAILED",
            ).slice(0, 120),
            failureMessage: String(
              failureMessage || "AI Tutor failed.",
            ).slice(0, 500),
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      await TutorConversation.findOneAndUpdate(
        {
          _id: conversationId,
          user: userId,
        },
        {
          $set: {
            isGenerating: false,
          },
        },
        {
          session: mongoSession,
        },
      );

      if (failedMessage) {
        const usageInc = {
          failedQuestions: 1,
        };

        if (reservation.isFree) {
          usageInc.freeQuestionsUsed = -1;
        } else {
          usageInc.paidQuestions = -1;
        }

        await TutorDailyUsage.findOneAndUpdate(
          {
            user: userId,
            dayKey: reservation.dayKey,
          },
          {
            $set: {
              isGenerating: false,
            },
            $inc: usageInc,
          },
          {
            session: mongoSession,
          },
        );
      } else {
        await TutorDailyUsage.findOneAndUpdate(
          {
            user: userId,
            dayKey: reservation.dayKey,
          },
          {
            $set: {
              isGenerating: false,
            },
          },
          {
            session: mongoSession,
          },
        );
      }

      if (
        failedMessage &&
        !reservation.isFree &&
        reservation.cost > 0
      ) {
        const updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,
            isActive: true,
          },
          {
            $inc: {
              fluxGems: reservation.cost,
            },
          },
          {
            new: true,
            session: mongoSession,
          },
        );

        if (!updatedUser) {
          throw new Error(
            "Unable to refund FluxGems for the failed Tutor question.",
          );
        }

        balance = Number(updatedUser.fluxGems || 0);

        await FluxGemTransaction.create(
          [
            {
              user: userId,
              type: "refund",
              amount: reservation.cost,
              balanceAfter: balance,
              reason: "ai_tutor_refund",
              tutorConversation: conversationId,
              tutorMessage: reservation.userMessageId,
              metadata: {
                questionCost: reservation.cost,
                dayKey: reservation.dayKey,
                failureCode,
              },
            },
          ],
          {
            session: mongoSession,
          },
        );

        refunded = true;
      }
    });

    return {
      refunded,
      balance,
    };
  } finally {
    await mongoSession.endSession();
  }
};
