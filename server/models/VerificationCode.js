import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    purpose: {
      type: String,
      required: true,
      enum: ["email_verification", "password_reset", "email_change"],
      index: true,
    },

    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    resendAvailableAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

verificationCodeSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  },
);

verificationCodeSchema.index({
  email: 1,
  purpose: 1,
  createdAt: -1,
});

const VerificationCode = mongoose.model(
  "VerificationCode",
  verificationCodeSchema,
);

export default VerificationCode;