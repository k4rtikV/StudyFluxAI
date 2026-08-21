import mongoose from "mongoose";

import DailyChallengeAttempt from "../models/DailyChallengeAttempt.js";
import FluxGemPurchase from "../models/FluxGemPurchase.js";
import LearningProfile from "../models/LearningProfile.js";
import PollVote from "../models/PollVote.js";
import StudySession from "../models/StudySession.js";
import User from "../models/User.js";
import { emitLeaderboardChanged } from "../realtime/socket.js";
import { queueLeaderboardRefresh, removeUserFromLeaderboard } from "./leaderboard.service.js";
import { getProgressOverview } from "./progression.service.js";

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializeUser = (user) => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  avatar: user.avatar || "",
  timezone: user.timezone || "UTC",
  timezoneUpdatedAt: user.timezoneUpdatedAt || null,
  authProviders: Array.isArray(user.authProviders) ? user.authProviders : [],
  isEmailVerified: Boolean(user.isEmailVerified),
  learningProfileCompleted: Boolean(user.learningProfileCompleted),
  fluxGems: Number(user.fluxGems || 0),
  isActive: Boolean(user.isActive),
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const studentFilter = { role: "student" };

export const getAdminUserOverview = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    active,
    verified,
    profileReady,
    googleUsers,
    newLast7Days,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(studentFilter),
    User.countDocuments({ ...studentFilter, isActive: true }),
    User.countDocuments({ ...studentFilter, isEmailVerified: true }),
    User.countDocuments({ ...studentFilter, learningProfileCompleted: true }),
    User.countDocuments({ ...studentFilter, authProviders: "google" }),
    User.countDocuments({ ...studentFilter, createdAt: { $gte: sevenDaysAgo } }),
    User.find(studentFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "fullName email avatar timezone timezoneUpdatedAt authProviders isEmailVerified learningProfileCompleted fluxGems isActive lastLoginAt createdAt updatedAt",
      )
      .lean(),
  ]);

  return {
    total,
    active,
    inactive: Math.max(total - active, 0),
    verified,
    profileReady,
    googleUsers,
    newLast7Days,
    recentUsers: recentUsers.map(serializeUser),
  };
};

export const listAdminUsers = async ({
  query = "",
  status = "all",
  provider = "all",
  page = 1,
  limit = 12,
} = {}) => {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 12, 5),
    50,
  );

  const filter = { ...studentFilter };
  const search = String(query || "").trim();

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ fullName: regex }, { email: regex }];
  }

  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (status === "verified") filter.isEmailVerified = true;
  if (status === "unverified") filter.isEmailVerified = false;
  if (status === "profile-ready") filter.learningProfileCompleted = true;
  if (status === "profile-pending") filter.learningProfileCompleted = false;

  if (["local", "google"].includes(provider)) {
    filter.authProviders = provider;
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit)
      .select(
        "fullName email avatar timezone timezoneUpdatedAt authProviders isEmailVerified learningProfileCompleted fluxGems isActive lastLoginAt createdAt updatedAt",
      )
      .lean(),
  ]);

  return {
    users: users.map(serializeUser),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(Math.ceil(total / normalizedLimit), 1),
    },
  };
};

const requireStudentUser = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError("Invalid user.");
  }

  const user = await User.findOne({ _id: userId, role: "student" }).lean();
  if (!user) throw httpError("Student account not found.", 404);
  return user;
};

export const getAdminUserDetails = async (userId) => {
  const user = await requireStudentUser(userId);

  const [
    learningProfile,
    completedSessions,
    challengeAttempts,
    correctChallengeAttempts,
    pollVotes,
    progressOverview,
    paidPurchaseAggregate,
  ] = await Promise.all([
    LearningProfile.findOne({ user: user._id }).lean(),
    StudySession.countDocuments({ user: user._id, status: "completed" }),
    DailyChallengeAttempt.countDocuments({ user: user._id }),
    DailyChallengeAttempt.countDocuments({ user: user._id, isCorrect: true }),
    PollVote.countDocuments({ user: user._id }),
    getProgressOverview(user._id),
    FluxGemPurchase.aggregate([
      { $match: { user: user._id, status: "paid" } },
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          gems: { $sum: "$gems" },
          amountPaise: { $sum: "$amountPaise" },
        },
      },
    ]),
  ]);

  const purchases = paidPurchaseAggregate[0] || {
    purchases: 0,
    gems: 0,
    amountPaise: 0,
  };

  return {
    user: serializeUser(user),
    learningProfile: learningProfile
      ? {
          educationLevel: learningProfile.educationLevel,
          institutionType: learningProfile.institutionType,
          institutionName: learningProfile.institutionName,
          program: learningProfile.program || "",
          stream: learningProfile.stream || "",
          updatedAt: learningProfile.updatedAt,
        }
      : null,
    stats: {
      completedStudySessions: completedSessions,
      challengeAttempts,
      correctChallengeAttempts,
      challengeAccuracy:
        challengeAttempts > 0
          ? Math.round((correctChallengeAttempts / challengeAttempts) * 100)
          : 0,
      pollVotes,
      totalXp: Number(progressOverview?.stats?.totalXp || 0),
      level: Number(progressOverview?.progression?.level || 1),
      achievementXp: Number(progressOverview?.stats?.achievementXp || 0),
      quizXp: Number(progressOverview?.stats?.quizXp || 0),
      dailyChallengeXp: Number(progressOverview?.stats?.dailyChallengeXp || 0),
      paidFluxGemPurchases: Number(purchases.purchases || 0),
      purchasedFluxGems: Number(purchases.gems || 0),
      purchaseAmountPaise: Number(purchases.amountPaise || 0),
    },
  };
};

export const updateAdminUserStatus = async ({ userId, isActive }) => {
  if (typeof isActive !== "boolean") {
    throw httpError("isActive must be true or false.");
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw httpError("Invalid user.");
  }

  const user = await User.findOne({ _id: userId, role: "student" }).select("+authVersion");
  if (!user) throw httpError("Student account not found.", 404);

  if (user.isActive !== isActive) {
    user.isActive = isActive;
    user.authVersion = Number(user.authVersion || 0) + 1;
    user.authMethodsUpdatedAt = new Date();
    await user.save();
  }

  if (isActive) {
    queueLeaderboardRefresh(user._id);
  } else {
    await removeUserFromLeaderboard(user._id);
    emitLeaderboardChanged({ reason: "user-deactivated" });
  }

  return serializeUser(user.toObject());
};
