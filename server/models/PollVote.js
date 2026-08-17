import mongoose from "mongoose";

const pollVoteSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityPoll",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    optionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true },
);

pollVoteSchema.index({ poll: 1, user: 1 }, { unique: true });
pollVoteSchema.index({ poll: 1, optionId: 1 });

export default mongoose.model("PollVote", pollVoteSchema);
