import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["announcement", "community", "reward", "system", "support"],
      default: "system",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    actionLabel: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailFailedAt: {
      type: Date,
      default: null,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
      index: true,
    },
    emailLeaseId: {
      type: String,
      default: "",
      select: false,
    },
    emailLeaseExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);