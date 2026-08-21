import mongoose from "mongoose";

import FluxGemTransaction from "../models/FluxGemTransaction.js";
import User from "../models/User.js";
import {
  getLevelFluxGemReward,
  MAX_LEVEL,
  SIGNUP_FLUXGEM_BONUS,
} from "../utils/progressionRules.js";

const SIGNUP_REWARD_KEY = "signup:welcome:v1";
const levelRewardKey = (level) => `level:${level}:v1`;

const grantMissingRewards = async ({ userId, rewards, retryOnConflict = true }) => {
  const normalized = rewards
    .map((reward) => ({
      ...reward,
      amount: Math.max(Math.floor(Number(reward.amount) || 0), 0),
      rewardKey: String(reward.rewardKey || "").trim(),
    }))
    .filter((reward) => reward.amount > 0 && reward.rewardKey);

  if (!normalized.length) {
    const user = await User.findById(userId).select("fluxGems").lean();
    return { granted: [], amount: 0, balance: Number(user?.fluxGems || 0) };
  }

  // Fast path for the overwhelmingly common case after a reward has already
  // been granted. This avoids opening a Mongo session on every auth/progress
  // read while the unique rewardKey index remains the final race guard.
  const rewardKeys = normalized.map((reward) => reward.rewardKey);
  const existingBeforeTransaction = await FluxGemTransaction.find({
    user: userId,
    rewardKey: { $in: rewardKeys },
  })
    .select("rewardKey")
    .lean();

  if (existingBeforeTransaction.length >= rewardKeys.length) {
    const user = await User.findById(userId).select("fluxGems").lean();
    return { granted: [], amount: 0, balance: Number(user?.fluxGems || 0) };
  }

  const session = await mongoose.startSession();
  try {
    let result = null;
    await session.withTransaction(async () => {
      const existing = await FluxGemTransaction.find({
        user: userId,
        rewardKey: { $in: normalized.map((reward) => reward.rewardKey) },
      })
        .select("rewardKey")
        .session(session)
        .lean();
      const existingKeys = new Set(existing.map((item) => item.rewardKey));
      const missing = normalized.filter((reward) => !existingKeys.has(reward.rewardKey));

      if (!missing.length) {
        const user = await User.findById(userId).select("fluxGems").session(session).lean();
        result = { granted: [], amount: 0, balance: Number(user?.fluxGems || 0) };
        return;
      }

      const total = missing.reduce((sum, reward) => sum + reward.amount, 0);
      const user = await User.findOneAndUpdate(
        { _id: userId, isActive: true },
        { $inc: { fluxGems: total } },
        { returnDocument: "after", session },
      );
      if (!user) {
        const error = new Error("User not found while granting FluxGem rewards.");
        error.code = "USER_NOT_FOUND";
        throw error;
      }

      let runningBalance = Number(user.fluxGems || 0) - total;
      const documents = missing.map((reward) => {
        runningBalance += reward.amount;
        return {
          user: userId,
          type: "reward",
          amount: reward.amount,
          balanceAfter: runningBalance,
          reason: reward.reason,
          rewardKey: reward.rewardKey,
          metadata: reward.metadata || {},
        };
      });
      await FluxGemTransaction.create(documents, { session, ordered: true });
      result = {
        granted: missing,
        amount: total,
        balance: Number(user.fluxGems || 0),
      };
    });
    return result;
  } catch (error) {
    if (retryOnConflict && error?.code === 11000) {
      return grantMissingRewards({ userId, rewards: normalized, retryOnConflict: false });
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const ensureSignupFluxGemBonus = async (userId) =>
  grantMissingRewards({
    userId,
    rewards: [
      {
        rewardKey: SIGNUP_REWARD_KEY,
        amount: SIGNUP_FLUXGEM_BONUS,
        reason: "signup_bonus",
        metadata: {
          kind: "signup_bonus",
          label: "Welcome to StudyFluxAI",
        },
      },
    ],
  });

export const syncLevelFluxGemRewards = async ({ userId, currentLevel }) => {
  const cappedLevel = Math.min(Math.max(Math.floor(Number(currentLevel) || 1), 1), MAX_LEVEL);
  const rewards = [];
  for (let level = 1; level <= cappedLevel; level += 1) {
    rewards.push({
      rewardKey: levelRewardKey(level),
      amount: getLevelFluxGemReward(level),
      reason: "level_reward",
      metadata: {
        kind: "level_reward",
        level,
        label: `Level ${level} reward`,
      },
    });
  }
  return grantMissingRewards({ userId, rewards });
};
