import mongoose from "mongoose";

const EDUCATION_LEVELS = [
  "",
  "class_7",
  "class_8",
  "class_9",
  "class_10",
  "class_11",
  "class_12",
  "diploma",
  "bachelors",
  "masters",
  "mba",
  "phd",
  "other",
];

const studySessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    generationType: {
      type: String,
      enum: ["combined", "notes", "quiz"],
      default: "combined",
      index: true,
    },

    sourceMode: {
      type: String,
      enum: ["topic", "source", "tutor"],
      required: true,
    },

    origin: {
      type: String,
      enum: ["ai_generation", "ai_tutor"],
      default: "ai_generation",
      index: true,
    },

    topic: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },

    sourceFile: {
      fileName: {
        type: String,
        trim: true,
        maxlength: 260,
        default: "",
      },
      mimeType: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
      size: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    // Immutable snapshot of the effective academic context used for this
    // generation. The canonical/default profile remains normalized in the
    // LearningProfile collection, while this snapshot preserves history even
    // if the user later edits their profile.
    academicContext: {
      educationLevel: {
        type: String,
        enum: EDUCATION_LEVELS,
        default: "",
      },
      institutionType: {
        type: String,
        enum: [
          "",
          "board",
          "university",
          "institution",
          "other",
        ],
        default: "",
      },
      institutionState: {
        type: String,
        trim: true,
        maxlength: 80,
        default: "",
      },
      institutionId: {
        type: String,
        trim: true,
        maxlength: 220,
        default: "",
      },
      institutionCategory: {
        type: String,
        trim: true,
        maxlength: 40,
        default: "",
      },
      institutionSector: {
        type: String,
        trim: true,
        maxlength: 40,
        default: "",
      },
      institutionKey: {
        type: String,
        trim: true,
        maxlength: 220,
        default: "",
      },
      institutionName: {
        type: String,
        trim: true,
        maxlength: 180,
        default: "",
      },
      programKey: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
      program: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
      streamKey: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
      stream: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
    },

    detailLevel: {
      type: String,
      enum: ["concise", "balanced", "deep"],
      default: "balanced",
    },

    difficulty: {
      type: String,
      enum: ["profile", "easy", "medium", "hard"],
      default: "profile",
    },

    quizSize: {
      type: Number,
      min: 0,
      max: 30,
      validate: {
        validator: (value) => Number.isInteger(value),
        message: "Quiz size must be a whole number.",
      },
      default: 0,
    },

    // Tutor-created derivatives can share the original quiz's progression
    // identity so cloning the same quiz cannot create fresh XP milestones.
    quizProgressionSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      default: null,
      index: true,
    },

    tutorProvenance: {
      conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TutorConversation",
        default: null,
        index: true,
      },
      assistantMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TutorMessage",
        default: null,
      },
      sourceStudySession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StudySession",
        default: null,
      },
      sourceKind: {
        type: String,
        enum: ["", "tutor_generated", "study_session_derivative"],
        default: "",
      },
      convertedAt: {
        type: Date,
        default: null,
      },
    },

    cost: {
      type: Number,
      min: 0,
      required: true,
    },

    status: {
      type: String,
      enum: ["generating", "completed", "failed"],
      default: "generating",
      index: true,
    },

    generationStage: {
      type: String,
      enum: ["queued", "primary", "fallback", "completed", "failed"],
      default: "queued",
      index: true,
    },

    generationMetrics: {
      queuedAt: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      primaryStartedAt: { type: Date, default: null },
      fallbackStartedAt: { type: Date, default: null },
      primaryDurationMs: { type: Number, min: 0, default: 0 },
      fallbackDurationMs: { type: Number, min: 0, default: 0 },
      totalDurationMs: { type: Number, min: 0, default: 0 },
      finishedAt: { type: Date, default: null },
    },

    chargedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    modelUsed: {
      type: String,
      trim: true,
      default: "",
    },

    fallbackUsed: {
      type: Boolean,
      default: false,
    },

    output: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    quizProgress: {
      attempts: {
        type: Number,
        min: 0,
        default: 0,
      },
      latestAnswers: {
        type: [Number],
        default: [],
      },
      latestScore: {
        type: Number,
        min: 0,
        default: 0,
      },
      totalQuestions: {
        type: Number,
        min: 0,
        default: 0,
      },
      latestPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      bestPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      firstCompletedAt: {
        type: Date,
        default: null,
      },
      lastCompletedAt: {
        type: Date,
        default: null,
      },
    },

    failureCode: {
      type: String,
      trim: true,
      default: "",
    },

    failureMessage: {
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
  {
    timestamps: true,
  },
);

studySessionSchema.index({ user: 1, createdAt: -1 });
studySessionSchema.index({ user: 1, generationType: 1, createdAt: -1 });
studySessionSchema.index(
  { "tutorProvenance.assistantMessage": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "tutorProvenance.assistantMessage": { $type: "objectId" },
    },
  },
);

const StudySession = mongoose.model(
  "StudySession",
  studySessionSchema,
);

export default StudySession;