import XPTransaction from "../models/XPTransaction.js";
import { QUIZ_XP_MILESTONES } from "../utils/progressionRules.js";

const unlockedAchievementEntries = (achievements = {}) =>
  Object.entries(achievements)
    .filter(([, item]) => item?.unlocked && Number(item?.xpReward || 0) > 0)
    .map(([key, item]) => ({
      key,
      amount: Number(item.xpReward || 0),
      earnedAt: item.earnedAt ? new Date(item.earnedAt) : new Date(),
    }))
    .filter((item) => !Number.isNaN(item.earnedAt.getTime()));

const safeDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const buildQuizEntries = (sessions = []) => {
  const entriesByKey = new Map();

  const addEntry = ({ studySession, milestone, amount, earnedAt }) => {
    const key = `${String(studySession)}:${milestone}`;
    const existing = entriesByKey.get(key);
    if (!existing || earnedAt < existing.earnedAt) {
      entriesByKey.set(key, { studySession, milestone, amount, earnedAt });
    }
  };

  for (const session of sessions) {
    const attempts = Number(session?.quizProgress?.attempts || 0);
    if (attempts <= 0 || !session?._id) continue;

    // Tutor derivatives that clone an existing Study Library quiz share the
    // original quiz's progression identity. A new Tutor-created quiz has no
    // source and therefore uses its own StudySession id.
    const progressionSession = session.quizProgressionSource || session._id;
    const firstCompletedAt = safeDate(
      session.quizProgress?.firstCompletedAt ||
        session.completedAt ||
        session.createdAt,
    );
    const latestCompletedAt = safeDate(
      session.quizProgress?.lastCompletedAt || firstCompletedAt,
      firstCompletedAt,
    );
    const bestPercentage = Number(session.quizProgress?.bestPercentage || 0);

    addEntry({
      studySession: progressionSession,
      milestone: "completion",
      amount: QUIZ_XP_MILESTONES.completion,
      earnedAt: firstCompletedAt,
    });

    if (bestPercentage >= 80) {
      addEntry({
        studySession: progressionSession,
        milestone: "score_80",
        amount: QUIZ_XP_MILESTONES.score_80,
        earnedAt: latestCompletedAt,
      });
    }

    if (bestPercentage >= 90) {
      addEntry({
        studySession: progressionSession,
        milestone: "score_90",
        amount: QUIZ_XP_MILESTONES.score_90,
        earnedAt: latestCompletedAt,
      });
    }
  }

  return [...entriesByKey.values()];
};

export const syncAchievementXpTransactions = async ({ userId, achievements }) => {
  const entries = unlockedAchievementEntries(achievements);

  if (entries.length === 0) {
    return { synced: 0 };
  }

  const existing = await XPTransaction.find({
    user: userId,
    reason: "achievement",
    achievementKey: { $in: entries.map((entry) => entry.key) },
  })
    .select("achievementKey")
    .lean();
  const existingKeys = new Set(existing.map((entry) => entry.achievementKey));
  const missingEntries = entries.filter((entry) => !existingKeys.has(entry.key));

  if (missingEntries.length === 0) {
    return { synced: 0 };
  }

  const operations = missingEntries.map((entry) => ({
    updateOne: {
      filter: {
        user: userId,
        reason: "achievement",
        achievementKey: entry.key,
      },
      update: {
        $setOnInsert: {
          user: userId,
          amount: entry.amount,
          reason: "achievement",
          achievementKey: entry.key,
          dailyChallenge: null,
          studySession: null,
          quizMilestone: null,
          earnedAt: entry.earnedAt,
          metadata: { source: "progression" },
        },
      },
      upsert: true,
    },
  }));

  try {
    const result = await XPTransaction.bulkWrite(operations, { ordered: false });
    return { synced: Number(result?.upsertedCount || 0) };
  } catch (error) {
    if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
      return { synced: 0 };
    }
    throw error;
  }
};

export const syncQuizXpTransactions = async ({ userId, sessions }) => {
  const entries = buildQuizEntries(sessions);

  if (entries.length === 0) {
    return { synced: 0 };
  }

  const sessionIds = [...new Set(entries.map((entry) => String(entry.studySession)))];
  const existing = await XPTransaction.find({
    user: userId,
    reason: "quiz",
    studySession: { $in: sessionIds },
  })
    .select("studySession quizMilestone")
    .lean();
  const existingKeys = new Set(
    existing.map((entry) => `${String(entry.studySession)}:${entry.quizMilestone}`),
  );
  const missingEntries = entries.filter(
    (entry) => !existingKeys.has(`${String(entry.studySession)}:${entry.milestone}`),
  );

  if (missingEntries.length === 0) {
    return { synced: 0 };
  }

  const operations = missingEntries.map((entry) => ({
    updateOne: {
      filter: {
        user: userId,
        reason: "quiz",
        studySession: entry.studySession,
        quizMilestone: entry.milestone,
      },
      update: {
        $setOnInsert: {
          user: userId,
          amount: entry.amount,
          reason: "quiz",
          dailyChallenge: null,
          achievementKey: null,
          studySession: entry.studySession,
          quizMilestone: entry.milestone,
          earnedAt: entry.earnedAt,
          metadata: {
            source: "generated_quiz",
            milestone: entry.milestone,
          },
        },
      },
      upsert: true,
    },
  }));

  try {
    const result = await XPTransaction.bulkWrite(operations, { ordered: false });
    return { synced: Number(result?.upsertedCount || 0) };
  } catch (error) {
    if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
      return { synced: 0 };
    }
    throw error;
  }
};

export const getXpLedgerTotals = async (userId) => {
  const rows = await XPTransaction.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: "$reason",
        total: { $sum: "$amount" },
      },
    },
  ]);

  const byReason = Object.fromEntries(
    rows.map((row) => [String(row._id || ""), Number(row.total || 0)]),
  );

  const achievementXp = Number(byReason.achievement || 0);
  const dailyChallengeXp = Number(byReason.daily_challenge || 0);
  const quizXp = Number(byReason.quiz || 0);
  const totalXp = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return {
    totalXp,
    achievementXp,
    dailyChallengeXp,
    quizXp,
    activityXp: dailyChallengeXp + quizXp,
  };
};
