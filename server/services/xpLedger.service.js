import XPTransaction from "../models/XPTransaction.js";

const unlockedAchievementEntries = (achievements = {}) =>
  Object.entries(achievements)
    .filter(([, item]) => item?.unlocked && Number(item?.xpReward || 0) > 0)
    .map(([key, item]) => ({
      key,
      amount: Number(item.xpReward || 0),
      earnedAt: item.earnedAt ? new Date(item.earnedAt) : new Date(),
    }))
    .filter((item) => !Number.isNaN(item.earnedAt.getTime()));

export const syncAchievementXpTransactions = async ({ userId, achievements }) => {
  const entries = unlockedAchievementEntries(achievements);

  if (entries.length === 0) {
    return { synced: 0 };
  }

  const now = new Date();
  const operations = entries.map((entry) => ({
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
          earnedAt: entry.earnedAt,
          metadata: { source: "progression" },
          createdAt: entry.earnedAt,
          updatedAt: now,
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
