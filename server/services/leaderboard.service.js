import mongoose from "mongoose";

import { getCachedJson, getRedisClient, setCachedJson } from "../config/redis.js";
import User from "../models/User.js";
import XPTransaction from "../models/XPTransaction.js";
import { emitLeaderboardChanged } from "../realtime/socket.js";
import { getProgressOverview } from "./progression.service.js";
import { getLevelProgress } from "../utils/progressionRules.js";

const LEADERBOARD_META_KEY = "studyflux:leaderboard:meta:v1";
const META_TTL_SECONDS = 6 * 60 * 60;
const BOARD_TYPES = new Set(["overall", "weekly", "monthly", "streak"]);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const httpError = (message, statusCode = 400, code = "LEADERBOARD_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const pad = (value) => String(value).padStart(2, "0");

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getPeriodInfo = (now = new Date()) => {
  const today = startOfUtcDay(now);
  const dayOfWeek = today.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const weekId = `${weekStart.getUTCFullYear()}-${pad(weekStart.getUTCMonth() + 1)}-${pad(weekStart.getUTCDate())}`;
  const monthId = `${monthStart.getUTCFullYear()}-${pad(monthStart.getUTCMonth() + 1)}`;

  return {
    timezone: "UTC",
    week: { id: weekId, startAt: weekStart, endAt: weekEnd },
    month: { id: monthId, startAt: monthStart, endAt: monthEnd },
  };
};

const getRedisKeys = (periodInfo) => ({
  overall: "studyflux:leaderboard:overall:v1",
  weekly: `studyflux:leaderboard:weekly:${periodInfo.week.id}:v1`,
  monthly: `studyflux:leaderboard:monthly:${periodInfo.month.id}:v1`,
  streak: "studyflux:leaderboard:streak:v1",
});

const normalizeBoard = (value) => {
  const candidate = String(value || "overall").trim().toLowerCase();
  if (!BOARD_TYPES.has(candidate)) {
    throw httpError("Choose a valid leaderboard view.", 400, "INVALID_LEADERBOARD_BOARD");
  }
  return candidate;
};

const aggregatePeriodXp = async ({ userId, periodInfo }) => {
  const [result] = await XPTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $project: {
        amount: 1,
        effectiveAt: { $ifNull: ["$earnedAt", "$createdAt"] },
      },
    },
    {
      $group: {
        _id: null,
        weeklyXp: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$effectiveAt", periodInfo.week.startAt] },
                  { $lt: ["$effectiveAt", periodInfo.week.endAt] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        monthlyXp: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$effectiveAt", periodInfo.month.startAt] },
                  { $lt: ["$effectiveAt", periodInfo.month.endAt] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  return {
    weeklyXp: Number(result?.weeklyXp || 0),
    monthlyXp: Number(result?.monthlyXp || 0),
  };
};

export const computeLeaderboardMetrics = async (userId, periodInfo = getPeriodInfo()) => {
  const progress = await getProgressOverview(userId);
  const periodXp = await aggregatePeriodXp({ userId, periodInfo });

  return {
    overallXp: Number(progress.stats?.totalXp || 0),
    weeklyXp: periodXp.weeklyXp,
    monthlyXp: periodXp.monthlyXp,
    currentStreak: Number(progress.stats?.currentStreak || 0),
    bestStreak: Number(progress.stats?.bestStreak || 0),
    achievementXp: Number(progress.stats?.achievementXp || 0),
    activityXp: Number(progress.stats?.activityXp || 0),
  };
};

const scoreForBoard = (metrics, board) => {
  if (board === "weekly") return metrics.weeklyXp;
  if (board === "monthly") return metrics.monthlyXp;
  if (board === "streak") return metrics.currentStreak;
  return metrics.overallXp;
};

const zAddMetrics = async ({ userId, metrics, periodInfo }) => {
  const client = getRedisClient();
  if (!client) return false;

  const keys = getRedisKeys(periodInfo);
  const member = String(userId);

  try {
    await client
      .multi()
      .zAdd(keys.overall, [{ score: metrics.overallXp, value: member }])
      .zAdd(keys.weekly, [{ score: metrics.weeklyXp, value: member }])
      .zAdd(keys.monthly, [{ score: metrics.monthlyXp, value: member }])
      .zAdd(keys.streak, [{ score: metrics.currentStreak, value: member }])
      .expire(keys.weekly, 45 * 24 * 60 * 60)
      .expire(keys.monthly, 400 * 24 * 60 * 60)
      .exec();
    return true;
  } catch (error) {
    console.warn("Leaderboard Redis update skipped:", error.message);
    return false;
  }
};

export const removeUserFromLeaderboard = async (userId) => {
  const client = getRedisClient();
  if (!client) return;

  const keys = getRedisKeys(getPeriodInfo());
  const member = String(userId);

  try {
    await client
      .multi()
      .zRem(keys.overall, member)
      .zRem(keys.weekly, member)
      .zRem(keys.monthly, member)
      .zRem(keys.streak, member)
      .exec();
  } catch {
    // MongoDB remains the source of truth.
  }
};

export const refreshUserLeaderboard = async (userId, { emit = true } = {}) => {
  const user = await User.findById(userId).select("role isActive").lean();

  if (!user || user.role !== "student" || !user.isActive) {
    await removeUserFromLeaderboard(userId);
    if (emit) emitLeaderboardChanged({ reason: "user-removed" });
    return null;
  }

  const periodInfo = getPeriodInfo();
  const metrics = await computeLeaderboardMetrics(userId, periodInfo);
  await zAddMetrics({ userId, metrics, periodInfo });

  if (emit) {
    emitLeaderboardChanged({ reason: "score-updated" });
  }

  return metrics;
};

export const queueLeaderboardRefresh = (userId) => {
  Promise.resolve()
    .then(() => refreshUserLeaderboard(userId, { emit: true }))
    .catch((error) => {
      console.warn("Leaderboard refresh skipped:", error.message);
    });
};

const loadActiveStudents = () =>
  User.find({ role: "student", isActive: true })
    .select("_id fullName avatar")
    .sort({ createdAt: 1 })
    .lean();

const buildAllMetrics = async ({ writeRedis = true } = {}) => {
  const periodInfo = getPeriodInfo();
  const users = await loadActiveStudents();
  const rows = [];
  const batchSize = 5;

  for (let index = 0; index < users.length; index += batchSize) {
    const batch = users.slice(index, index + batchSize);
    const computed = await Promise.all(
      batch.map(async (user) => {
        const metrics = await computeLeaderboardMetrics(user._id, periodInfo);
        if (writeRedis) {
          await zAddMetrics({ userId: user._id, metrics, periodInfo });
        }
        return { user, metrics };
      }),
    );
    rows.push(...computed);
  }

  return { rows, periodInfo };
};

export const rebuildLeaderboardCache = async ({ emit = true } = {}) => {
  const client = getRedisClient();
  const periodInfo = getPeriodInfo();
  const keys = getRedisKeys(periodInfo);

  if (client) {
    try {
      await client.del([
        keys.overall,
        keys.weekly,
        keys.monthly,
        keys.streak,
        LEADERBOARD_META_KEY,
      ]);
    } catch {
      // Continue with a MongoDB rebuild even if deletion fails.
    }
  }

  const { rows } = await buildAllMetrics({ writeRedis: Boolean(client) });
  const meta = {
    builtAt: new Date().toISOString(),
    participants: rows.length,
    weekId: periodInfo.week.id,
    monthId: periodInfo.month.id,
  };

  if (client) {
    await setCachedJson(LEADERBOARD_META_KEY, meta, META_TTL_SECONDS);
  }

  if (emit) {
    emitLeaderboardChanged({ reason: "rebuild", updatedAt: meta.builtAt });
  }

  return { ...meta, redisActive: Boolean(client) };
};

const ensureLeaderboardCache = async () => {
  const client = getRedisClient();
  if (!client) return null;

  const periodInfo = getPeriodInfo();
  const [meta, activeCount] = await Promise.all([
    getCachedJson(LEADERBOARD_META_KEY),
    User.countDocuments({ role: "student", isActive: true }),
  ]);

  if (
    !meta ||
    meta.weekId !== periodInfo.week.id ||
    meta.monthId !== periodInfo.month.id ||
    Number(meta.participants || 0) !== Number(activeCount || 0)
  ) {
    return rebuildLeaderboardCache({ emit: false });
  }

  return { ...meta, redisActive: true };
};

const serializeEntry = ({ rank, user, metrics, board, currentUserId, exposeUserId = false }) => ({
  rank,
  ...(exposeUserId ? { userId: String(user._id) } : {}),
  fullName: user.fullName || "StudyFluxAI learner",
  avatar: user.avatar || "",
  level: getLevelProgress(metrics.overallXp).level,
  score: scoreForBoard(metrics, board),
  overallXp: metrics.overallXp,
  weeklyXp: metrics.weeklyXp,
  monthlyXp: metrics.monthlyXp,
  currentStreak: metrics.currentStreak,
  bestStreak: metrics.bestStreak,
  isCurrentUser: currentUserId
    ? String(user._id) === String(currentUserId)
    : false,
});

const getMongoFallbackLeaderboard = async ({ board, currentUserId, limit, exposeUserId }) => {
  const { rows, periodInfo } = await buildAllMetrics({ writeRedis: false });

  rows.sort((a, b) => {
    const scoreDiff = scoreForBoard(b.metrics, board) - scoreForBoard(a.metrics, board);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.metrics.overallXp !== a.metrics.overallXp) {
      return b.metrics.overallXp - a.metrics.overallXp;
    }
    return String(a.user.fullName || "").localeCompare(String(b.user.fullName || ""));
  });

  const entries = rows.slice(0, limit).map((row, index) =>
    serializeEntry({
      rank: index + 1,
      ...row,
      board,
      currentUserId,
      exposeUserId,
    }),
  );

  const viewerIndex = currentUserId
    ? rows.findIndex((row) => String(row.user._id) === String(currentUserId))
    : -1;

  const viewerEntry = viewerIndex >= 0
    ? serializeEntry({
        rank: viewerIndex + 1,
        ...rows[viewerIndex],
        board,
        currentUserId,
        exposeUserId,
      })
    : null;

  return {
    entries,
    viewerEntry,
    participants: rows.length,
    periodInfo,
    redisActive: false,
    cacheBuiltAt: null,
  };
};

const getRedisLeaderboard = async ({ board, currentUserId, limit, exposeUserId }) => {
  const client = getRedisClient();
  if (!client) return null;

  const meta = await ensureLeaderboardCache();
  const periodInfo = getPeriodInfo();
  const key = getRedisKeys(periodInfo)[board];

  try {
    const topScores = await client.zRangeWithScores(key, 0, limit - 1, { REV: true });
    const ids = topScores.map((item) => item.value);
    const users = await User.find({
      _id: { $in: ids },
      role: "student",
      isActive: true,
    })
      .select("fullName avatar")
      .lean();
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const rows = await Promise.all(
      topScores.map(async (item, index) => {
        const user = userMap.get(String(item.value));
        if (!user) return null;
        const metrics = await computeLeaderboardMetrics(user._id, periodInfo);
        return serializeEntry({
          rank: index + 1,
          user,
          metrics,
          board,
          currentUserId,
          exposeUserId,
        });
      }),
    );

    let viewerEntry = null;

    if (currentUserId) {
      const viewerRank = await client.zRevRank(key, String(currentUserId));
      if (viewerRank !== null) {
        const viewerUser = await User.findOne({
          _id: currentUserId,
          role: "student",
          isActive: true,
        })
          .select("fullName avatar")
          .lean();

        if (viewerUser) {
          const viewerMetrics = await computeLeaderboardMetrics(viewerUser._id, periodInfo);
          viewerEntry = serializeEntry({
            rank: Number(viewerRank) + 1,
            user: viewerUser,
            metrics: viewerMetrics,
            board,
            currentUserId,
            exposeUserId,
          });
        }
      }
    }

    return {
      entries: rows.filter(Boolean),
      viewerEntry,
      participants: Number(meta?.participants || 0),
      periodInfo,
      redisActive: true,
      cacheBuiltAt: meta?.builtAt || null,
    };
  } catch (error) {
    console.warn("Leaderboard Redis read skipped:", error.message);
    return null;
  }
};

export const getLeaderboard = async ({
  board = "overall",
  currentUserId = null,
  limit = DEFAULT_LIMIT,
  exposeUserId = false,
} = {}) => {
  const normalizedBoard = normalizeBoard(board);
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || DEFAULT_LIMIT, 3),
    MAX_LIMIT,
  );

  if (currentUserId) {
    await refreshUserLeaderboard(currentUserId, { emit: false });
  }

  const redisResult = await getRedisLeaderboard({
    board: normalizedBoard,
    currentUserId,
    limit: normalizedLimit,
    exposeUserId,
  });

  const result =
    redisResult ||
    (await getMongoFallbackLeaderboard({
      board: normalizedBoard,
      currentUserId,
      limit: normalizedLimit,
      exposeUserId,
    }));

  const period =
    normalizedBoard === "weekly"
      ? result.periodInfo.week
      : normalizedBoard === "monthly"
        ? result.periodInfo.month
        : null;

  return {
    board: normalizedBoard,
    timezone: result.periodInfo.timezone,
    period: period
      ? { id: period.id, startAt: period.startAt, endAt: period.endAt }
      : null,
    entries: result.entries,
    viewerEntry: result.viewerEntry,
    participants: result.participants,
    realtime: true,
    redisActive: result.redisActive,
    cacheBuiltAt: result.cacheBuiltAt,
    updatedAt: new Date().toISOString(),
  };
};

export const getLeaderboardAdminStatus = async () => {
  const client = getRedisClient();
  const meta = client ? await getCachedJson(LEADERBOARD_META_KEY) : null;
  const activeLearners = await User.countDocuments({ role: "student", isActive: true });
  const periodInfo = getPeriodInfo();

  return {
    activeLearners,
    redisActive: Boolean(client),
    cacheBuiltAt: meta?.builtAt || null,
    cacheParticipants: Number(meta?.participants || 0),
    timezone: periodInfo.timezone,
    week: periodInfo.week,
    month: periodInfo.month,
  };
};
