import mongoose from "mongoose";

const dailyChallengeAttemptSchema = new mongoose.Schema(
  {
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    xpEarned: {
      type: Number,
      min: 0,
      default: 0,
    },
    fluxGemsEarned: {
      type: Number,
      min: 0,
      default: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

dailyChallengeAttemptSchema.index(
  { challenge: 1, user: 1 },
  { unique: true },
);

dailyChallengeAttemptSchema.index({ user: 1, answeredAt: -1 });

export default mongoose.model(
  "DailyChallengeAttempt",
  dailyChallengeAttemptSchema,
);
