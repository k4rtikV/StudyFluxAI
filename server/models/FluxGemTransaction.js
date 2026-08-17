import mongoose from "mongoose";

const fluxGemTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "spend",
        "refund",
        "grant",
        "purchase",
        "reward",
      ],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isInteger(value) && value !== 0,
        message: "FluxGem transaction amount must be a non-zero integer.",
      },
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: [
        "ai_generation",
        "ai_generation_refund",
        "ai_tutor",
        "ai_tutor_refund",
        "developer_grant",
        "purchase",
        "reward",
        "daily_challenge_reward",
      ],
      required: true,
      index: true,
    },

    studySession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      default: null,
      index: true,
    },


    tutorConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorConversation",
      default: null,
      index: true,
    },

    tutorMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorMessage",
      default: null,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

fluxGemTransactionSchema.index({ user: 1, createdAt: -1 });

const FluxGemTransaction = mongoose.model(
  "FluxGemTransaction",
  fluxGemTransactionSchema,
);

export default FluxGemTransaction;
