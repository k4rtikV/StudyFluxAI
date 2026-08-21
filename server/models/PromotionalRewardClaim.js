import mongoose from "mongoose";

const promotionalRewardClaimSchema = new mongoose.Schema(
  {
    rewardKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    identityHash: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

promotionalRewardClaimSchema.index(
  { rewardKey: 1, identityHash: 1 },
  { unique: true },
);

export default mongoose.model("PromotionalRewardClaim", promotionalRewardClaimSchema);