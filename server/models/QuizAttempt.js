import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studySession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      required: true,
      index: true,
    },
    answers: {
      type: [Number],
      default: [],
    },
    score: {
      type: Number,
      min: 0,
      required: true,
    },
    totalQuestions: {
      type: Number,
      min: 1,
      required: true,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

quizAttemptSchema.index({ user: 1, attemptedAt: -1 });
quizAttemptSchema.index({ user: 1, studySession: 1, attemptedAt: -1 });

export default mongoose.model("QuizAttempt", quizAttemptSchema);
