import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "global",
      immutable: true,
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
    supportFormEnabled: {
      type: Boolean,
      default: true,
    },
    supportResponseSlaHours: {
      type: Number,
      min: 1,
      max: 168,
      default: 48,
    },
    emailDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
    announcementEmailDefault: {
      type: Boolean,
      default: false,
    },
    communityEmailEnabled: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("PlatformSettings", platformSettingsSchema);
