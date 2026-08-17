import mongoose from "mongoose";

const challengeOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
  },
  { _id: false },
);

const dailyChallengeSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    options: {
      type: [challengeOptionSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 4,
        message: "A daily challenge must have exactly four options.",
      },
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      select: false,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "General Knowledge",
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
      index: true,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    xpReward: {
      type: Number,
      min: 0,
      max: 1000,
      default: 20,
    },
    fluxGemReward: {
      type: Number,
      min: 0,
      max: 500,
      default: 5,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "ended"],
      default: "draft",
      index: true,
    },
    publishAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

dailyChallengeSchema.pre("validate", function () {
  if (["scheduled", "live"].includes(this.status)) {
    if (!this.publishAt || !this.expiresAt) {
      this.invalidate(
        "publishAt",
        "Scheduled and live challenges require publish and expiry times.",
      );
      return;
    }

    if (new Date(this.expiresAt) <= new Date(this.publishAt)) {
      this.invalidate("expiresAt", "Expiry must be after the publish time.");
    }
  }
});

dailyChallengeSchema.index({ status: 1, publishAt: 1, expiresAt: 1 });

export default mongoose.model("DailyChallenge", dailyChallengeSchema);
