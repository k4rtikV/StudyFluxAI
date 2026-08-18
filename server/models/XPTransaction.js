import mongoose from "mongoose";

const ACHIEVEMENT_KEYS = [
  "first_step",
  "quiz_starter",
  "focused_learner",
  "three_day_spark",
  "one_week_streak",
  "consistency_champion",
  "sharp_mind",
  "near_perfect",
  "challenge_winner",
];

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
      enum: ["daily_challenge", "achievement"],
      required: true,
      index: true,
    },
    dailyChallenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      default: null,
      index: true,
    },
    achievementKey: {
      type: String,
      enum: ACHIEVEMENT_KEYS,
      default: null,
      index: true,
    },
    earnedAt: {
      type: Date,
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
xpTransactionSchema.index({ user: 1, earnedAt: -1 });
xpTransactionSchema.index(
  { user: 1, reason: 1, dailyChallenge: 1 },
  { unique: true, partialFilterExpression: { dailyChallenge: { $type: "objectId" } } },
);
xpTransactionSchema.index(
  { user: 1, reason: 1, achievementKey: 1 },
  { unique: true, partialFilterExpression: { achievementKey: { $type: "string" } } },
);

export default mongoose.model("XPTransaction", xpTransactionSchema);
