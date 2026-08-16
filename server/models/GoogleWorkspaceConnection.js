import mongoose from "mongoose";

const googleWorkspaceConnectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["google_forms"],
      default: "google_forms",
      required: true,
    },

    encryptedRefreshToken: {
      type: String,
      required: true,
      select: false,
    },

    scopes: {
      type: [String],
      default: [],
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const GoogleWorkspaceConnection = mongoose.model(
  "GoogleWorkspaceConnection",
  googleWorkspaceConnectionSchema,
);

export default GoogleWorkspaceConnection;
