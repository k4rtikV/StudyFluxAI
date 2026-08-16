import mongoose from "mongoose";

const learningProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    educationLevel: {
      type: String,
      required: true,
      enum: [
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
      ],
    },

    institutionType: {
      type: String,
      required: true,
      enum: [
        "board",
        "university",
        "institution",
        "other",
      ],
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
      enum: [
        "",
        "university",
        "college",
        "institute",
        "diploma",
        "other",
      ],
      default: "",
    },

    institutionSector: {
      type: String,
      trim: true,
      enum: [
        "",
        "private",
        "public",
        "other",
      ],
      default: "",
    },

    institutionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    institutionName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
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
    timestamps: true,
  },
);

const LearningProfile = mongoose.model(
  "LearningProfile",
  learningProfileSchema,
);

export default LearningProfile;