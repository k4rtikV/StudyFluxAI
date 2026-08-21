import mongoose from "mongoose";

const studyExportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    studySession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudySession",
      required: true,
      index: true,
    },

    exportType: {
      type: String,
      enum: ["google_forms"],
      required: true,
      default: "google_forms",
    },

    exportMode: {
      type: String,
      enum: ["standard", "student_details"],
      default: "standard",
    },

    status: {
      type: String,
      enum: ["creating", "created", "failed"],
      default: "creating",
      index: true,
    },

    externalId: {
      type: String,
      trim: true,
      default: "",
    },

    editUrl: {
      type: String,
      trim: true,
      default: "",
    },

    responderUrl: {
      type: String,
      trim: true,
      default: "",
    },

    leaseToken: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    leaseExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    lastError: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    exportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

studyExportSchema.index(
  {
    studySession: 1,
    exportType: 1,
    exportMode: 1,
  },
  {
    unique: true,
  },
);

studyExportSchema.index({
  user: 1,
  createdAt: -1,
});

const StudyExport = mongoose.model(
  "StudyExport",
  studyExportSchema,
);

export default StudyExport;