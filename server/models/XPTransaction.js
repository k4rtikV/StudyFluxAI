import mongoose from "mongoose";

const xpTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      enum: ["daily_challenge"],
      required: true,
      index: true,
    },
    dailyChallenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

xpTransactionSchema.index({ user: 1, createdAt: -1 });
xpTransactionSchema.index(
  { user: 1, reason: 1, dailyChallenge: 1 },
  { unique: true, partialFilterExpression: { dailyChallenge: { $type: "objectId" } } },
);

export default mongoose.model("XPTransaction", xpTransactionSchema);
