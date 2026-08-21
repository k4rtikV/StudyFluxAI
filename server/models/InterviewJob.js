import mongoose from "mongoose";

const interviewJobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorConversation",
      default: null,
      index: true,
    },
    userMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorMessage",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["report", "tutor_analysis"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      min: 1,
      max: 10,
      default: 3,
    },
    runAfter: {
      type: Date,
      default: Date.now,
      index: true,
    },
    leaseUntil: {
      type: Date,
      default: null,
      index: true,
    },
    workerToken: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    lastErrorCode: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    lastErrorMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

interviewJobSchema.index(
  { interview: 1, type: 1 },
  { unique: true },
);
interviewJobSchema.index({ status: 1, runAfter: 1, leaseUntil: 1 });

export default mongoose.model("InterviewJob", interviewJobSchema);
