import mongoose from "mongoose";

import { deleteCacheKeys, getCachedJson, setCachedJson } from "../config/redis.js";
import CommunityPoll from "../models/CommunityPoll.js";
import DailyChallenge from "../models/DailyChallenge.js";
import DailyChallengeAttempt from "../models/DailyChallengeAttempt.js";
import FluxGemTransaction from "../models/FluxGemTransaction.js";
import PollVote from "../models/PollVote.js";
import User from "../models/User.js";
import XPTransaction from "../models/XPTransaction.js";
import { emitPollResults } from "../realtime/socket.js";
import { queueLeaderboardRefresh } from "./leaderboard.service.js";
import { broadcastCommunityPublication } from "./notification.service.js";
import { getProgressOverview } from "./progression.service.js";
import { getLevelTransition } from "../utils/progressionRules.js";

const POLL_CACHE_TTL_SECONDS = 45;

const httpError = (message, statusCode = 400, code = "COMMUNITY_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export const syncCommunityStatuses = async () => {
  const now = new Date();

  const [dueChallenges, duePolls] = await Promise.all([
    DailyChallenge.find({
      status: "scheduled",
      publishAt: { $lte: now },
      expiresAt: { $gt: now },
    }).lean(),
    CommunityPoll.find({
      status: "scheduled",
      publishAt: { $lte: now },
      expiresAt: { $gt: now },
    }).lean(),
  ]);

  await Promise.all([
    DailyChallenge.updateMany(
      {
        status: "scheduled",
        publishAt: { $lte: now },
        expiresAt: { $gt: now },
      },
      { $set: { status: "live" } },
    ),
    DailyChallenge.updateMany(
      {
        status: { $in: ["scheduled", "live"] },
        expiresAt: { $lte: now },
      },
      { $set: { status: "ended" } },
    ),
    CommunityPoll.updateMany(
      {
        status: "scheduled",
        publishAt: { $lte: now },
        expiresAt: { $gt: now },
      },
      { $set: { status: "live" } },
    ),
    CommunityPoll.updateMany(
      {
        status: { $in: ["scheduled", "live"] },
        expiresAt: { $lte: now },
      },
      { $set: { status: "ended" } },
    ),
  ]);

  await Promise.allSettled([
    ...dueChallenges.map((item) =>
      broadcastCommunityPublication({ kind: "challenge", item }),
    ),
    ...duePolls.map((item) =>
      broadcastCommunityPublication({ kind: "poll", item }),
    ),
  ]);
};

const serializeAttempt = (attempt) =>
  attempt
    ? {
        selectedOptionIndex: attempt.selectedOptionIndex,
        isCorrect: Boolean(attempt.isCorrect),
        xpEarned: Number(attempt.xpEarned || 0),
        fluxGemsEarned: Number(attempt.fluxGemsEarned || 0),
        answeredAt: attempt.answeredAt,
      }
    : null;

const serializeChallengeForUser = (challenge, attempt = null) => ({
  id: String(challenge._id),
  question: challenge.question,
  options: challenge.options.map((option, index) => ({
    index,
    text: option.text,
  })),
  category: challenge.category,
  difficulty: challenge.difficulty,
  xpReward: Number(challenge.xpReward || 0),
  fluxGemReward: Number(challenge.fluxGemReward || 0),
  publishAt: challenge.publishAt,
  expiresAt: challenge.expiresAt,
  attempt: serializeAttempt(attempt),
  ...(attempt
    ? {
        correctOptionIndex: Number(challenge.correctOptionIndex),
        explanation: challenge.explanation || "",
      }
    : {}),
});

export const getTodayChallenge = async (userId) => {
  await syncCommunityStatuses();

  const now = new Date();
  const challenge = await DailyChallenge.findOne({
    status: "live",
    publishAt: { $lte: now },
    expiresAt: { $gt: now },
  })
    .select("+correctOptionIndex")
    .sort({ publishAt: -1 })
    .lean();

  if (!challenge) {
    return null;
  }

  const attempt = await DailyChallengeAttempt.findOne({
    challenge: challenge._id,
    user: userId,
  }).lean();

  return serializeChallengeForUser(challenge, attempt);
};

export const submitDailyChallenge = async ({ userId, challengeId, selectedOptionIndex }) => {
  if (!mongoose.isValidObjectId(challengeId)) {
    throw httpError("Invalid daily challenge.", 400, "INVALID_CHALLENGE");
  }

  const selected = Number(selectedOptionIndex);
  if (!Number.isInteger(selected) || selected < 0 || selected > 3) {
    throw httpError("Choose one of the challenge options.", 400, "INVALID_OPTION");
  }

  await syncCommunityStatuses();

  const beforeProgress = await getProgressOverview(userId);
  const mongoSession = await mongoose.startSession();
  let responseData = null;

  try {
    await mongoSession.withTransaction(async () => {
      const now = new Date();
      const challenge = await DailyChallenge.findOne({
        _id: challengeId,
        status: "live",
        publishAt: { $lte: now },
        expiresAt: { $gt: now },
      })
        .select("+correctOptionIndex")
        .session(mongoSession);

      if (!challenge) {
        throw httpError(
          "This daily challenge is no longer available.",
          404,
          "CHALLENGE_NOT_AVAILABLE",
        );
      }

      const existingAttempt = await DailyChallengeAttempt.findOne({
        challenge: challenge._id,
        user: userId,
      })
        .session(mongoSession)
        .lean();

      if (existingAttempt) {
        throw httpError(
          "You have already answered today's challenge.",
          409,
          "CHALLENGE_ALREADY_ANSWERED",
        );
      }

      const isCorrect = selected === Number(challenge.correctOptionIndex);
      const xpEarned = isCorrect ? Number(challenge.xpReward || 0) : 0;
      const fluxGemsEarned = isCorrect
        ? Number(challenge.fluxGemReward || 0)
        : 0;

      const [attempt] = await DailyChallengeAttempt.create(
        [
          {
            challenge: challenge._id,
            user: userId,
            selectedOptionIndex: selected,
            isCorrect,
            xpEarned,
            fluxGemsEarned,
            answeredAt: now,
          },
        ],
        { session: mongoSession },
      );

      let balance = null;

      if (isCorrect && fluxGemsEarned > 0) {
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId, isActive: true },
          { $inc: { fluxGems: fluxGemsEarned } },
          { returnDocument: "after", session: mongoSession },
        );

        if (!updatedUser) {
          throw httpError("Unable to credit your challenge reward.", 409);
        }

        balance = Number(updatedUser.fluxGems || 0);

        await FluxGemTransaction.create(
          [
            {
              user: userId,
              type: "reward",
              amount: fluxGemsEarned,
              balanceAfter: balance,
              reason: "daily_challenge_reward",
              metadata: {
                dailyChallengeId: String(challenge._id),
                category: challenge.category,
              },
            },
          ],
          { session: mongoSession },
        );
      } else {
        const currentUser = await User.findById(userId)
          .select("fluxGems")
          .session(mongoSession)
          .lean();
        balance = Number(currentUser?.fluxGems || 0);
      }

      if (isCorrect && xpEarned > 0) {
        await XPTransaction.create(
          [
            {
              user: userId,
              amount: xpEarned,
              reason: "daily_challenge",
              dailyChallenge: challenge._id,
              earnedAt: now,
              metadata: {
                category: challenge.category,
                difficulty: challenge.difficulty,
              },
            },
          ],
          { session: mongoSession },
        );
      }

      responseData = {
        challenge: serializeChallengeForUser(challenge.toObject(), attempt.toObject()),
        balance,
      };
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(
        "You have already answered today's challenge.",
        409,
        "CHALLENGE_ALREADY_ANSWERED",
      );
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }

  const afterProgress = await getProgressOverview(userId);
  const previousTotalXp = Number(beforeProgress?.stats?.totalXp || 0);
  const currentTotalXp = Number(afterProgress?.stats?.totalXp || 0);

  responseData.balance = Number(
    afterProgress?.progression?.fluxGemsBalance ?? responseData.balance ?? 0,
  );

  responseData.progression = {
    ...afterProgress.progression,
    xpEarned: Math.max(currentTotalXp - previousTotalXp, 0),
    dailyChallengeXpEarned: Math.max(
      Number(afterProgress?.stats?.dailyChallengeXp || 0) -
        Number(beforeProgress?.stats?.dailyChallengeXp || 0),
      0,
    ),
    achievementXpEarned: Math.max(
      Number(afterProgress?.stats?.achievementXp || 0) -
        Number(beforeProgress?.stats?.achievementXp || 0),
      0,
    ),
    levelUp: getLevelTransition(previousTotalXp, currentTotalXp),
  };

  queueLeaderboardRefresh(userId);

  if (responseData?.challenge?.attempt?.isCorrect) {
    const xp = Number(responseData.challenge.attempt.xpEarned || 0);
    const gems = Number(responseData.challenge.attempt.fluxGemsEarned || 0);
    createUserNotification({
      userId,
      type: "reward",
      title: "Daily Challenge reward earned",
      body: `Correct answer — +${xp} XP${gems > 0 ? ` and +${gems} FluxGems` : ""}.`,
      actionUrl: "/daily-challenges",
      actionLabel: "View challenge",
      priority: "normal",
      dedupeKey: `daily-challenge:${String(challengeId)}:reward`,
      emailRequested: false,
      metadata: { dailyChallengeId: String(challengeId), xp, fluxGems: gems },
    }).catch((error) => console.warn("Challenge reward notification failed:", error.message));
  }

  return responseData;
};

const pollResultsCacheKey = (pollId) => `studyflux:poll:${pollId}:results`;

export const getPollResults = async (poll) => {
  const pollId = String(poll._id);
  const cacheKey = pollResultsCacheKey(pollId);
  const cached = await getCachedJson(cacheKey);

  if (cached) return cached;

  const grouped = await PollVote.aggregate([
    { $match: { poll: poll._id } },
    { $group: { _id: "$optionId", count: { $sum: 1 } } },
  ]);

  const countByOption = new Map(
    grouped.map((entry) => [String(entry._id), Number(entry.count || 0)]),
  );

  const totalVotes = grouped.reduce(
    (sum, entry) => sum + Number(entry.count || 0),
    0,
  );

  const results = {
    totalVotes,
    options: poll.options.map((option) => {
      const count = countByOption.get(String(option._id)) || 0;
      return {
        optionId: String(option._id),
        count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      };
    }),
  };

  await setCachedJson(cacheKey, results, POLL_CACHE_TTL_SECONDS);
  return results;
};

const serializePoll = async (poll, userId) => {
  const [vote, results] = await Promise.all([
    PollVote.findOne({ poll: poll._id, user: userId }).lean(),
    getPollResults(poll),
  ]);

  return {
    id: String(poll._id),
    question: poll.question,
    options: poll.options.map((option) => ({
      id: String(option._id),
      text: option.text,
    })),
    publishAt: poll.publishAt,
    expiresAt: poll.expiresAt,
    userVoteOptionId: vote ? String(vote.optionId) : null,
    results,
  };
};

export const getActiveCommunityPolls = async (userId) => {
  await syncCommunityStatuses();

  const now = new Date();
  const polls = await CommunityPoll.find({
    status: "live",
    publishAt: { $lte: now },
    expiresAt: { $gt: now },
  })
    .sort({ publishAt: -1 })
    .limit(5)
    .lean();

  return Promise.all(polls.map((poll) => serializePoll(poll, userId)));
};

export const voteInCommunityPoll = async ({ userId, pollId, optionId }) => {
  if (!mongoose.isValidObjectId(pollId) || !mongoose.isValidObjectId(optionId)) {
    throw httpError("Invalid community poll selection.", 400, "INVALID_POLL_OPTION");
  }

  await syncCommunityStatuses();

  const now = new Date();
  const poll = await CommunityPoll.findOne({
    _id: pollId,
    status: "live",
    publishAt: { $lte: now },
    expiresAt: { $gt: now },
  });

  if (!poll) {
    throw httpError("This poll is no longer available.", 404, "POLL_NOT_AVAILABLE");
  }

  const optionExists = poll.options.some(
    (option) => String(option._id) === String(optionId),
  );

  if (!optionExists) {
    throw httpError("Choose a valid poll option.", 400, "INVALID_POLL_OPTION");
  }

  try {
    await PollVote.create({
      poll: poll._id,
      user: userId,
      optionId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(
        "You have already voted in this poll.",
        409,
        "POLL_ALREADY_VOTED",
      );
    }
    throw error;
  }

  await deleteCacheKeys(pollResultsCacheKey(poll._id));
  const results = await getPollResults(poll);
  emitPollResults(poll._id, results);

  return {
    pollId: String(poll._id),
    userVoteOptionId: String(optionId),
    results,
  };
};
