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

    clientRequestId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 160,
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      maxlength: 160,
    },

    status: {
      type: String,
      enum: ["creating", "created", "pending", "paid", "failed"],
      default: "creating",
      index: true,
    },

    providerOrderStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    providerPaymentStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
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
      maxlength: 160,
    },

    lastReconciledAt: {
      type: Date,
      default: null,
    },

    receiptEmailSentAt: {
      type: Date,
      default: null,
    },

    receiptEmailClaimedAt: {
      type: Date,
      default: null,
    },

    receiptEmailFailedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

fluxGemPurchaseSchema.index({ user: 1, createdAt: -1 });
fluxGemPurchaseSchema.index({ user: 1, status: 1, createdAt: -1 });
fluxGemPurchaseSchema.index(
  { user: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: "string" } },
  },
);


const FluxGemPurchase = mongoose.model(
  "FluxGemPurchase",
  fluxGemPurchaseSchema,
);

export default FluxGemPurchase;
