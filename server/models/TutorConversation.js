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

const academicContextSchema = new mongoose.Schema(
  {
    educationLevel: {
      type: String,
      enum: EDUCATION_LEVELS,
      default: "",
    },
    institutionType: {
      type: String,
      enum: ["", "board", "university", "institution", "other"],
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
  {
    _id: false,
  },
);

const tutorConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "New tutor chat",
    },

    academicContext: {
      type: academicContextSchema,
      default: () => ({}),
    },

    contextStudySession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      default: null,
      index: true,
    },

    contextTitle: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },

    sourceInterview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      default: null,
      index: true,
    },

    sourceInterviewUsesLearnerProfile: {
      type: Boolean,
      default: null,
    },

    messageCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    successfulQuestionCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    nextSequence: {
      type: Number,
      min: 0,
      default: 0,
    },

    isGenerating: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastModelUsed: {
      type: String,
      trim: true,
      default: "",
    },

    fallbackUsed: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

tutorConversationSchema.index({
  user: 1,
  archivedAt: 1,
  lastMessageAt: -1,
});

tutorConversationSchema.index(
  { user: 1, sourceInterview: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceInterview: { $type: "objectId" },
      archivedAt: null,
    },
  },
);

const TutorConversation = mongoose.model(
  "TutorConversation",
  tutorConversationSchema,
);

export default TutorConversation;
