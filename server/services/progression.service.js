import FluxGemTransaction from "../models/FluxGemTransaction.js";
import StudySession from "../models/StudySession.js";
import TutorConversation from "../models/TutorConversation.js";
import TutorMessage from "../models/TutorMessage.js";
import DailyChallengeAttempt from "../models/DailyChallengeAttempt.js";
import XPTransaction from "../models/XPTransaction.js";
import User from "../models/User.js";
import {
  getLocalTodayDayNumber,
  normalizeTimeZone,
  toLocalDayNumber,
} from "../utils/timezone.js";

const ACHIEVEMENT_XP = {
  first_step: 50,
  quiz_starter: 50,
  focused_learner: 250,
  three_day_spark: 100,
  one_week_streak: 250,
  consistency_champion: 1000,
  sharp_mind: 100,
  near_perfect: 150,
  challenge_winner: 100,
};

const calculateStreaks = (dateValues, timeZone) => {
  const uniqueDays = [
    ...new Set(
      dateValues
        .map((value) => toLocalDayNumber(value, timeZone))
        .filter((value) => Number.isFinite(value)),
    ),
  ].sort((a, b) => a - b);

  if (uniqueDays.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let runningStreak = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    if (uniqueDays[index] === uniqueDays[index - 1] + 1) {
      runningStreak += 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      runningStreak = 1;
    }
  }

  const latestDay = uniqueDays.at(-1);
  const today = getLocalTodayDayNumber(timeZone);

  let currentStreak = 0;

  if (latestDay === today || latestDay === today - 1) {
    currentStreak = 1;

    for (let index = uniqueDays.length - 1; index > 0; index -= 1) {
      if (uniqueDays[index - 1] === uniqueDays[index] - 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, bestStreak };
};

const achievement = ({ key, current, target }) => ({
  key,
  current: Math.min(Math.max(Number(current) || 0, 0), target),
  target,
  unlocked: Number(current) >= target,
  xpReward: ACHIEVEMENT_XP[key] || 0,
});

export const getProgressOverview = async (userId) => {
  const user = await User.findById(userId)
    .select("timezone")
    .lean();

  const timeZone = normalizeTimeZone(user?.timezone);

  const sessions = await StudySession.find({
    user: userId,
    status: "completed",
  })
    .select("generationType createdAt completedAt quizProgress")
    .sort({ completedAt: 1, createdAt: 1 })
    .lean();

  const completedSessions = sessions.length;
  const completedQuizzes = sessions.filter(
    (session) => Number(session.quizProgress?.attempts || 0) > 0,
  ).length;

  const completedTutorQuestions = await TutorMessage.countDocuments({
    user: userId,
    role: "user",
    status: "completed",
  });

  const tutorActivityMessages = await TutorMessage.find({
    user: userId,
    role: "user",
    status: "completed",
    completedAt: { $ne: null },
  })
    .select("completedAt")
    .sort({ completedAt: 1 })
    .lean();

  const challengeAttempts = await DailyChallengeAttempt.find({
    user: userId,
  })
    .select("isCorrect answeredAt xpEarned fluxGemsEarned")
    .sort({ answeredAt: 1 })
    .lean();

  const challengeWins = challengeAttempts.filter(
    (attempt) => attempt.isCorrect,
  ).length;

  const bestQuizPercentage = sessions.reduce(
    (best, session) =>
      Math.max(
        best,
        Number(session.quizProgress?.bestPercentage || 0),
      ),
    0,
  );

  const activityDates = [
    ...sessions.map(
      (session) => session.completedAt || session.createdAt,
    ),
    ...tutorActivityMessages.map(
      (message) => message.completedAt,
    ),
    ...challengeAttempts.map((attempt) => attempt.answeredAt),
  ];

  const { currentStreak, bestStreak } = calculateStreaks(
    activityDates,
    timeZone,
  );

  const achievements = {
    first_step: achievement({
      key: "first_step",
      current: completedSessions,
      target: 1,
    }),
    quiz_starter: achievement({
      key: "quiz_starter",
      current: completedQuizzes,
      target: 1,
    }),
    focused_learner: achievement({
      key: "focused_learner",
      current: completedSessions,
      target: 10,
    }),
    three_day_spark: achievement({
      key: "three_day_spark",
      current: bestStreak,
      target: 3,
    }),
    one_week_streak: achievement({
      key: "one_week_streak",
      current: bestStreak,
      target: 7,
    }),
    consistency_champion: achievement({
      key: "consistency_champion",
      current: bestStreak,
      target: 30,
    }),
    sharp_mind: achievement({
      key: "sharp_mind",
      current: bestQuizPercentage >= 80 ? 1 : 0,
      target: 1,
    }),
    near_perfect: achievement({
      key: "near_perfect",
      current: bestQuizPercentage >= 90 ? 1 : 0,
      target: 1,
    }),
    challenge_winner: achievement({
      key: "challenge_winner",
      current: challengeWins,
      target: 1,
    }),
  };

  const achievementValues = Object.values(achievements);
  const unlockedAchievements = achievementValues.filter(
    (item) => item.unlocked,
  );
  const achievementXp = unlockedAchievements.reduce(
    (total, item) => total + item.xpReward,
    0,
  );

  const activityXpTotals = await XPTransaction.aggregate([
    { $match: { user: userId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const activityXp = Number(activityXpTotals[0]?.total || 0);
  const totalXp = achievementXp + activityXp;

  const rewardTotals = await FluxGemTransaction.aggregate([
    {
      $match: {
        user: userId,
        type: "reward",
        amount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const gemRewardsEarned = Number(rewardTotals[0]?.total || 0);

  const recentSessions = await StudySession.find({
    user: userId,
    status: "completed",
  })
    .select(
      "generationType topic sourceMode sourceFile output quizSize quizProgress createdAt completedAt",
    )
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const recentTutorConversations = await TutorConversation.find({
    user: userId,
    archivedAt: null,
    successfulQuestionCount: { $gt: 0 },
  })
    .select(
      "title contextTitle successfulQuestionCount lastMessageAt createdAt",
    )
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(3)
    .lean();

  return {
    stats: {
      completedSessions,
      completedQuizzes,
      completedTutorQuestions,
      currentStreak,
      bestStreak,
      bestQuizPercentage,
      unlockedCount: unlockedAchievements.length,
      achievementXp,
      activityXp,
      totalXp,
      completedDailyChallenges: challengeAttempts.length,
      challengeWins,
      gemRewardsEarned,
      streakTimeZone: timeZone,
    },
    achievements,
    recentSessions: recentSessions.map((session) => ({
      id: session._id,
      title:
        session.output?.sessionTitle ||
        session.topic ||
        session.sourceFile?.fileName ||
        "Learning session",
      description: session.output?.shortDescription || "",
      generationType: session.generationType || "combined",
      quizSize: Number(session.quizSize || 0),
      quizAttempts: Number(session.quizProgress?.attempts || 0),
      latestQuizScore: Number(session.quizProgress?.latestScore || 0),
      latestQuizTotal: Number(
        session.quizProgress?.totalQuestions || session.quizSize || 0,
      ),
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    })),
    recentTutorConversations: recentTutorConversations.map(
      (conversation) => ({
        id: conversation._id,
        title: conversation.title || "Tutor conversation",
        contextTitle: conversation.contextTitle || "",
        successfulQuestionCount: Number(
          conversation.successfulQuestionCount || 0,
        ),
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      }),
    ),
  };
};
