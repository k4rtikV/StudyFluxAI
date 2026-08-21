export const LEVEL_THRESHOLDS = Object.freeze([
  0,
  250,
  600,
  1050,
  1600,
  2250,
  3000,
  3900,
  4950,
  6150,
  7500,
  9000,
]);

export const SIGNUP_FLUXGEM_BONUS = 100;

export const LEVEL_FLUXGEM_REWARDS = Object.freeze(
  LEVEL_THRESHOLDS.map((_, index) => (index + 1 <= 8 ? 50 : 100)),
);

export const getLevelFluxGemReward = (levelValue) => {
  const level = Math.floor(Number(levelValue) || 0);
  if (level < 1 || level > LEVEL_FLUXGEM_REWARDS.length) return 0;
  return LEVEL_FLUXGEM_REWARDS[level - 1];
};


export const ACHIEVEMENT_XP = Object.freeze({
  first_step: 50,
  quiz_starter: 50,
  focused_learner: 250,
  three_day_spark: 100,
  one_week_streak: 250,
  consistency_champion: 1000,
  sharp_mind: 100,
  near_perfect: 150,
  challenge_winner: 100,
  first_interview: 100,
  interview_five: 250,
  interview_ten: 500,
  interview_variety: 200,
  role_rehearsal: 150,
  interview_improver: 250,
});

export const SMART_INTERVIEW_XP = Object.freeze({
  dailyCompletion: 75,
});

export const QUIZ_XP_MILESTONES = Object.freeze({
  completion: 20,
  score_80: 30,
  score_90: 50,
});

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

const normalizeXp = (value) => Math.max(Number(value) || 0, 0);

export const getLevelProgress = (totalXpValue) => {
  const totalXp = normalizeXp(totalXpValue);

  let level = 1;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (totalXp >= LEVEL_THRESHOLDS[index]) {
      level = index + 1;
    } else {
      break;
    }
  }

  const isMaxLevel = level >= MAX_LEVEL;
  const currentLevelXp = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelXp = isMaxLevel ? null : LEVEL_THRESHOLDS[level];
  const xpIntoLevel = Math.max(totalXp - currentLevelXp, 0);
  const xpForLevel = isMaxLevel
    ? 0
    : Math.max(Number(nextLevelXp) - currentLevelXp, 1);
  const xpToNextLevel = isMaxLevel
    ? 0
    : Math.max(Number(nextLevelXp) - totalXp, 0);
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(Math.floor((xpIntoLevel / xpForLevel) * 100), 99);

  return {
    level,
    maxLevel: MAX_LEVEL,
    totalXp,
    currentLevelXp,
    nextLevel: isMaxLevel ? null : level + 1,
    nextLevelXp,
    xpIntoLevel,
    xpForLevel,
    xpToNextLevel,
    progressPercent,
    isMaxLevel,
  };
};

export const getLevelTransition = (previousXpValue, currentXpValue) => {
  const previous = getLevelProgress(previousXpValue);
  const current = getLevelProgress(currentXpValue);

  return {
    leveledUp: current.level > previous.level,
    previousLevel: previous.level,
    currentLevel: current.level,
    levelsGained: Math.max(current.level - previous.level, 0),
  };
};

export const getPublicProgressionRules = () => ({
  levels: LEVEL_THRESHOLDS.map((threshold, index) => ({
    level: index + 1,
    threshold,
    fluxGemReward: getLevelFluxGemReward(index + 1),
  })),
  quizMilestones: [
    {
      key: "completion",
      label: "Complete a generated quiz",
      xp: QUIZ_XP_MILESTONES.completion,
      oncePerSession: true,
    },
    {
      key: "score_80",
      label: "Score 80% or higher",
      xp: QUIZ_XP_MILESTONES.score_80,
      oncePerSession: true,
    },
    {
      key: "score_90",
      label: "Score 90% or higher",
      xp: QUIZ_XP_MILESTONES.score_90,
      oncePerSession: true,
    },
  ],
  smartInterview: {
    completionXp: SMART_INTERVIEW_XP.dailyCompletion,
    firstCompletionPerLocalDayOnly: true,
  },
  xpPurchasable: false,
});
