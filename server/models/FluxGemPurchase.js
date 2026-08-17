import mongoose from "mongoose";

const fluxGemPurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    packageId: {
      type: String,
      enum: ["starter", "popular", "power-learner"],
      required: true,
    },

    gems: {
      type: Number,
      required: true,
      min: 1,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    signatureVerifiedAt: {
      type: Date,
      default: null,
    },

    capturedAt: {
      type: Date,
      default: null,
    },

    creditedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: "",
      maxlength: 500,
    },

    lastWebhookEventId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

fluxGemPurchaseSchema.index({ user: 1, createdAt: -1 });

const FluxGemPurchase = mongoose.model(
  "FluxGemPurchase",
  fluxGemPurchaseSchema,
);

export default FluxGemPurchase;
