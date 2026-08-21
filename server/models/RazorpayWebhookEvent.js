import mongoose from "mongoose";

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 160,
    },
    providerEventId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    payloadHash: {
      type: String,
      required: true,
      maxlength: 64,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FluxGemPurchase",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["processing", "processed", "failed", "ignored"],
      default: "processing",
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      maxlength: 800,
    },
  },
  { timestamps: true },
);

razorpayWebhookEventSchema.index({ status: 1, updatedAt: 1 });
razorpayWebhookEventSchema.index({ eventType: 1, createdAt: -1 });

const RazorpayWebhookEvent = mongoose.model(
  "RazorpayWebhookEvent",
  razorpayWebhookEventSchema,
);

export default RazorpayWebhookEvent;
