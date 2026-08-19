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

    externalId: {
      type: String,
      trim: true,
      required: true,
    },

    editUrl: {
      type: String,
      trim: true,
      required: true,
    },

    responderUrl: {
      type: String,
      trim: true,
      required: true,
    },

    exportedAt: {
      type: Date,
      default: Date.now,
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
