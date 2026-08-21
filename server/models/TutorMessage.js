import mongoose from "mongoose";

const tutorMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorConversation",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32000,
    },

    sequence: {
      type: Number,
      min: 1,
      required: true,
    },

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "completed",
      index: true,
    },

    billing: {
      isFree: {
        type: Boolean,
        default: true,
      },
      cost: {
        type: Number,
        min: 0,
        default: 0,
      },
      dayKey: {
        type: String,
        trim: true,
        maxlength: 10,
        default: "",
      },
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

    failureCode: {
      type: String,
      trim: true,
      maxlength: 120,
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

    convertedStudySession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      default: null,
      index: true,
    },

    convertedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

tutorMessageSchema.index(
  { conversation: 1, sequence: 1 },
  { unique: true },
);

tutorMessageSchema.index({
  user: 1,
  status: 1,
  completedAt: -1,
});

const TutorMessage = mongoose.model(
  "TutorMessage",
  tutorMessageSchema,
);

export default TutorMessage;
