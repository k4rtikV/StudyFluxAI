import crypto from "node:crypto";
import mongoose from "mongoose";

import FluxGemTransaction from "../models/FluxGemTransaction.js";
import PromotionalRewardClaim from "../models/PromotionalRewardClaim.js";
import User from "../models/User.js";
import { notifyFluxGemRewards } from "./notification.service.js";
import {
  getLevelFluxGemReward,
  MAX_LEVEL,
  SIGNUP_FLUXGEM_BONUS,
} from "../utils/progressionRules.js";

const SIGNUP_REWARD_KEY = "signup:welcome:v1";
const levelRewardKey = (level) => `level:${level}:v1`;

const canonicalizePromotionalEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";

  // Gmail ignores dots in the local part and routes +tags to the same inbox.
  // Apply this only to Gmail-family addresses; other providers have different rules.
  if (domain === "gmail.com") {
    local = local.split("+", 1)[0].replaceAll(".", "");
  }

  return `${local}@${domain}`;
};

const promotionalIdentityHash = (email) =>
  crypto.createHash("sha256").update(canonicalizePromotionalEmail(email)).digest("hex");

const claimSignupRewardIdentity = async (user) => {
  const identityHash = promotionalIdentityHash(user?.email);
  if (!identityHash) return true;

  try {
    await PromotionalRewardClaim.create({
      rewardKey: SIGNUP_REWARD_KEY,
      identityHash,
      user: user._id,
    });
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await PromotionalRewardClaim.findOne({
      rewardKey: SIGNUP_REWARD_KEY,
      identityHash,
    }).lean();
    return String(existing?.user || "") === String(user._id);
  }
};

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
    if (result?.granted?.length) {
      await notifyFluxGemRewards({ userId, granted: result.granted });
    }
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

export const ensureSignupFluxGemBonus = async (userId) => {
  const user = await User.findById(userId)
    .select("email fluxGems role isEmailVerified")
    .lean();

  if (!user || user.role !== "student" || user.isEmailVerified !== true) {
    return { granted: [], amount: 0, balance: Number(user?.fluxGems || 0) };
  }

  const identityAvailable = await claimSignupRewardIdentity(user);
  if (!identityAvailable) {
    return { granted: [], amount: 0, balance: Number(user.fluxGems || 0) };
  }

  return grantMissingRewards({
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
};

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