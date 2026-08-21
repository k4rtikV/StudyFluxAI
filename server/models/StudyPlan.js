import mongoose from "mongoose";

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
      index: true,
    },
    goal: {
      type: String,
      trim: true,
      maxlength: 600,
      default: "",
    },
    targetAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      min: 15,
      max: 720,
      default: 60,
      validate: {
        validator: Number.isInteger,
        message: "Study duration must be a whole number of minutes.",
      },
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed"],
      default: "planned",
      index: true,
    },
    linkedStudySessions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "StudySession",
        },
      ],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length <= 12,
        message: "A study plan can link up to 12 Study Library items.",
      },
    },
    completedAt: {
      type: Date,
      default: null,
    },
    reminder7dTargetAt: {
      type: Date,
      default: null,
    },
    reminder7dDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    reminder7dStatus: {
      type: String,
      enum: ["not_scheduled", "pending", "processing", "sent", "skipped", "failed"],
      default: "not_scheduled",
      index: true,
    },
    reminder7dAttemptCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    reminder7dClaimedAt: {
      type: Date,
      default: null,
    },
    reminder7dNextAttemptAt: {
      type: Date,
      default: null,
    },
    reminder7dSentAt: {
      type: Date,
      default: null,
    },
    reminder7dLastError: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

studyPlanSchema.index({ user: 1, status: 1, targetAt: 1 });
studyPlanSchema.index({ user: 1, createdAt: -1 });
studyPlanSchema.index({ reminder7dStatus: 1, reminder7dDueAt: 1, reminder7dNextAttemptAt: 1 });

const StudyPlan = mongoose.model("StudyPlan", studyPlanSchema);

export default StudyPlan;
