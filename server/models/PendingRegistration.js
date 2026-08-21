import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    claimTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

pendingRegistrationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema,
);

export default PendingRegistration;
