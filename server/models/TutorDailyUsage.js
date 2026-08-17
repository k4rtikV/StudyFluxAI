import mongoose from "mongoose";

const tutorDailyUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    dayKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    freeQuestionsUsed: {
      type: Number,
      min: 0,
      default: 0,
    },

    paidQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },

    successfulQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },

    failedQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },

    attemptedQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },

    isGenerating: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastRequestAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

tutorDailyUsageSchema.index(
  { user: 1, dayKey: 1 },
  { unique: true },
);

const TutorDailyUsage = mongoose.model(
  "TutorDailyUsage",
  tutorDailyUsageSchema,
);

export default TutorDailyUsage;
