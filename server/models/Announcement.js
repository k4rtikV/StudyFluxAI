import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
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
      maxlength: 3000,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    actionLabel: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    emailDelivery: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    emailSentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

announcementSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
