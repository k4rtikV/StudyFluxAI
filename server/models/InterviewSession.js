import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, maxlength: 220, default: "" },
    mimeType: { type: String, trim: true, maxlength: 120, default: "" },
    sizeBytes: { type: Number, min: 0, default: 0 },
    content: { type: Buffer, select: false, default: null },
  },
  { _id: false },
);

const profileSnapshotSchema = new mongoose.Schema(
  {
    educationLevel: { type: String, default: "" },
    institutionName: { type: String, default: "" },
    program: { type: String, default: "" },
    stream: { type: String, default: "" },
  },
  { _id: false },
);

const readinessSnapshotSchema = new mongoose.Schema(
  {
    microphoneVerified: { type: Boolean, default: false },
    testRecordingConfirmed: { type: Boolean, default: false },
    networkVerified: { type: Boolean, default: false },
    averageLatencyMs: { type: Number, min: 0, default: 0 },
    jitterMs: { type: Number, min: 0, default: 0 },
    uploadMs: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const interviewerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 40, default: "Astra" },
    voice: { type: String, trim: true, maxlength: 60, default: "Kore" },
  },
  { _id: false },
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startRequestId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    targetRole: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    experienceLevel: {
      type: String,
      required: true,
      enum: ["fresher", "entry", "junior", "mid", "senior"],
    },
    interviewType: {
      type: String,
      required: true,
      enum: ["behavioral", "technical", "coding", "mixed"],
      index: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
      index: true,
    },
    phase: {
      type: String,
      enum: ["ready", "interviewing", "report_generating", "report_ready"],
      default: "ready",
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
      default: 100,
    },
    profileSnapshot: {
      type: profileSnapshotSchema,
      default: () => ({}),
    },
    readinessSnapshot: {
      type: readinessSnapshotSchema,
      default: () => ({}),
    },
    resume: {
      type: resumeSchema,
      default: null,
    },
    resumeContext: {
      type: String,
      trim: true,
      maxlength: 12000,
      default: "",
    },
    interviewer: {
      type: interviewerSchema,
      default: () => ({}),
    },
    engineVersion: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "voice-v1",
    },
    maxQuestions: {
      type: Number,
      min: 1,
      max: 20,
      default: 8,
    },
    questionCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    currentQuestion: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    transcript: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    finalReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completionTimezone: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    completionLocalDay: {
      type: Number,
      default: null,
      index: true,
    },
    progressionReward: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

  },
  { timestamps: true },
);

interviewSessionSchema.index(
  { user: 1, startRequestId: 1 },
  { unique: true },
);
interviewSessionSchema.index({ user: 1, createdAt: -1 });

const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);

export default InterviewSession;
