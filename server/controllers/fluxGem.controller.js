import FluxGemTransaction from "../models/FluxGemTransaction.js";

const TRANSACTION_TYPES = new Set([
  "spend",
  "refund",
  "grant",
  "purchase",
  "reward",
]);

const TRANSACTION_REASONS = new Set([
  "ai_generation",
  "ai_generation_refund",
  "ai_tutor",
  "ai_tutor_refund",
  "ai_tutor_quiz_conversion",
  "developer_grant",
  "purchase",
  "reward",
  "daily_challenge_reward",
]);

const serializeTransaction = (transaction) => ({
  id: transaction._id,
  type: transaction.type,
  amount: transaction.amount,
  balanceAfter: transaction.balanceAfter,
  reason: transaction.reason,
  metadata: transaction.metadata || {},
  studySession: transaction.studySession
    ? {
        id: transaction.studySession._id,
        title:
          transaction.studySession.output?.sessionTitle ||
          transaction.studySession.topic ||
          "Learning session",
        generationType:
          transaction.studySession.generationType || "combined",
      }
    : null,
  tutorConversation: transaction.tutorConversation
    ? {
        id: transaction.tutorConversation._id,
        title:
          transaction.tutorConversation.title ||
          "Tutor conversation",
      }
    : null,
  createdAt: transaction.createdAt,
});

export const getFluxGemActivity = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 20);
    const requestedPage = Number(req.query.page || 1);

    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1),
      50,
    );

    const page = Math.max(
      Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
      1,
    );

    const filter = {
      user: req.user._id,
    };

    if (req.query.type && TRANSACTION_TYPES.has(req.query.type)) {
      filter.type = req.query.type;
    }

    if (req.query.reason && TRANSACTION_REASONS.has(req.query.reason)) {
      filter.reason = req.query.reason;
    }

    const transactions = await FluxGemTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .populate({
        path: "studySession",
        select: "generationType topic output",
      })
      .populate({
        path: "tutorConversation",
        select: "title",
      })
      .lean();

    const hasMore = transactions.length > limit;
    const pageTransactions = hasMore
      ? transactions.slice(0, limit)
      : transactions;

    return res.status(200).json({
      success: true,
      data: {
        transactions: pageTransactions.map(serializeTransaction),
        pagination: {
          page,
          limit,
          hasMore,
          nextPage: hasMore ? page + 1 : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
