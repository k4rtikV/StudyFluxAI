import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 240,
  },
});

const communityPollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    options: {
      type: [pollOptionSchema],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length >= 2 && value.length <= 6,
        message: "A community poll must have between two and six options.",
      },
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "ended"],
      default: "draft",
      index: true,
    },
    publishAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

communityPollSchema.pre("validate", function () {
  if (["scheduled", "live"].includes(this.status)) {
    if (!this.publishAt || !this.expiresAt) {
      this.invalidate(
        "publishAt",
        "Scheduled and live polls require publish and expiry times.",
      );
      return;
    }

    if (new Date(this.expiresAt) <= new Date(this.publishAt)) {
      this.invalidate("expiresAt", "Expiry must be after the publish time.");
    }
  }
});

communityPollSchema.index({ status: 1, publishAt: 1, expiresAt: 1 });

export default mongoose.model("CommunityPoll", communityPollSchema);
