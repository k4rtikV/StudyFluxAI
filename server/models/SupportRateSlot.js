import mongoose from "mongoose";

const supportRateSlotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bucketStart: {
      type: Date,
      required: true,
    },
    slot: {
      type: Number,
      required: true,
      min: 0,
      max: 2,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

supportRateSlotSchema.index(
  { user: 1, bucketStart: 1, slot: 1 },
  { unique: true },
);
supportRateSlotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SupportRateSlot", supportRateSlotSchema);