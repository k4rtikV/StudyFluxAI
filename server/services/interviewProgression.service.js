import InterviewSession from "../models/InterviewSession.js";
import XPTransaction from "../models/XPTransaction.js";
import User from "../models/User.js";
import {
  ACHIEVEMENT_XP,
  getLevelTransition,
} from "../utils/progressionRules.js";
import {
  normalizeTimeZone,
  toLocalDayNumber,
} from "../utils/timezone.js";
import {
  getXpLedgerTotals,
  syncAchievementXpTransactions,
  syncInterviewXpTransactions,
} from "./xpLedger.service.js";

const normalizeRole = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const safeDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const scoreInterview = (interview) => {
  const scores = (interview?.transcript || [])
    .map((turn) => Number(turn?.evaluation?.score))
    .filter(Number.isFinite);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

const makeAchievement = ({ key, current, target, earnedAt = null }) => ({
  key,
  current: Math.min(Math.max(Number(current) || 0, 0), target),
  target,
  unlocked: Number(current) >= target,
  xpReward: ACHIEVEMENT_XP[key] || 0,
  earnedAt: Number(current) >= target && earnedAt ? earnedAt : null,
});

const firstDateAtDistinctCount = (interviews, field, target) => {
  const seen = new Set();
  for (const interview of interviews) {
    const value = String(interview?.[field] || "").trim();
    if (value) seen.add(value);
    if (seen.size >= target) return safeDate(interview.completedAt);
  }
  return null;
};

const roleRehearsalState = (interviews, target = 3) => {
  const counts = new Map();
  let earnedAt = null;
  let maxCount = 0;
  for (const interview of interviews) {
    const key = normalizeRole(interview.targetRole);
    if (!key) continue;
    const next = (counts.get(key) || 0) + 1;
    counts.set(key, next);
    maxCount = Math.max(maxCount, next);
    if (!earnedAt && next >= target) earnedAt = safeDate(interview.completedAt);
  }
  return { current: maxCount, earnedAt };
};

const improvementState = (interviews, target = 10) => {
  const previousByTrack = new Map();
  let bestImprovement = 0;
  let earnedAt = null;

  for (const interview of interviews) {
    const role = normalizeRole(interview.targetRole);
    const type = String(interview.interviewType || "").trim();
    if (!role || !type) continue;
    const key = `${role}::${type}`;
    const score = scoreInterview(interview);
    const previous = previousByTrack.get(key);
    if (previous) {
      const improvement = score - previous.score;
      bestImprovement = Math.max(bestImprovement, improvement);
      if (!earnedAt && improvement >= target) earnedAt = safeDate(interview.completedAt);
    }
    previousByTrack.set(key, { score, completedAt: interview.completedAt });
  }

  return { current: Math.max(bestImprovement, 0), earnedAt };
};

export const buildInterviewAchievements = (interviews = []) => {
  const completed = [...interviews]
    .filter((interview) => interview?.status === "completed" || interview?.completedAt)
    .sort((a, b) => new Date(a.completedAt || 0) - new Date(b.completedAt || 0));

  const rolePractice = roleRehearsalState(completed, 3);
  const improvement = improvementState(completed, 10);
  const distinctTypes = new Set(completed.map((item) => item.interviewType).filter(Boolean)).size;

  return {
    first_interview: makeAchievement({
      key: "first_interview",
      current: completed.length,
      target: 1,
      earnedAt: completed[0]?.completedAt || null,
    }),
    interview_five: makeAchievement({
      key: "interview_five",
      current: completed.length,
      target: 5,
      earnedAt: completed[4]?.completedAt || null,
    }),
    interview_ten: makeAchievement({
      key: "interview_ten",
      current: completed.length,
      target: 10,
      earnedAt: completed[9]?.completedAt || null,
    }),
    interview_variety: makeAchievement({
      key: "interview_variety",
      current: distinctTypes,
      target: 3,
      earnedAt: firstDateAtDistinctCount(completed, "interviewType", 3),
    }),
    role_rehearsal: makeAchievement({
      key: "role_rehearsal",
      current: rolePractice.current,
      target: 3,
      earnedAt: rolePractice.earnedAt,
    }),
    interview_improver: makeAchievement({
      key: "interview_improver",
      current: improvement.current,
      target: 10,
      earnedAt: improvement.earnedAt,
    }),
  };
};

export const syncSmartInterviewProgression = async ({ userId, interviewId = null }) => {
  const [user, interviews, before] = await Promise.all([
    User.findById(userId).select("timezone").lean(),
    InterviewSession.find({ user: userId, status: "completed" })
      .select("targetRole interviewType transcript completedAt completionTimezone completionLocalDay createdAt status")
      .sort({ completedAt: 1, createdAt: 1 })
      .lean(),
    getXpLedgerTotals(userId),
  ]);

  const timeZone = normalizeTimeZone(user?.timezone);
  const achievements = buildInterviewAchievements(interviews);

  await Promise.all([
    syncInterviewXpTransactions({ userId, interviews, timeZone }),
    syncAchievementXpTransactions({ userId, achievements }),
  ]);

  const after = await getXpLedgerTotals(userId);
  const levelUp = getLevelTransition(before.totalXp, after.totalXp);

  let currentInterviewXp = 0;
  if (interviewId) {
    const transaction = await XPTransaction.findOne({
      user: userId,
      reason: "smart_interview",
      interviewSession: interviewId,
    })
      .select("amount")
      .lean();
    currentInterviewXp = Number(transaction?.amount || 0);
  }

  return {
    xpEarned: Math.max(after.totalXp - before.totalXp, 0),
    interviewCompletionXp: currentInterviewXp,
    achievementXpEarned: Math.max(after.totalXp - before.totalXp - currentInterviewXp, 0),
    totalXp: after.totalXp,
    levelUp,
    antiFarmingApplied: Boolean(interviewId && currentInterviewXp === 0),
    timeZone,
    achievements,
  };
};

export const stampInterviewCompletionDay = async ({ userId, interview, completedAt }) => {
  const user = await User.findById(userId).select("timezone").lean();
  const timeZone = normalizeTimeZone(user?.timezone);
  const localDay = toLocalDayNumber(completedAt, timeZone);
  interview.completionTimezone = timeZone;
  interview.completionLocalDay = Number.isFinite(localDay) ? localDay : null;
  return { timeZone, localDay };
};
