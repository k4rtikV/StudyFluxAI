import FluxGemTransaction from "../models/FluxGemTransaction.js";

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
  createdAt: transaction.createdAt,
});

export const getFluxGemActivity = async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 10);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1),
      50,
    );

    const transactions = await FluxGemTransaction.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "studySession",
        select: "generationType topic output",
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        transactions: transactions.map(serializeTransaction),
      },
    });
  } catch (error) {
    next(error);
  }
};
