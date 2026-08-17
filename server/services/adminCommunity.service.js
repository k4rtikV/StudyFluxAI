import mongoose from "mongoose";

import { deleteCacheKeys } from "../config/redis.js";
import CommunityPoll from "../models/CommunityPoll.js";
import DailyChallenge from "../models/DailyChallenge.js";
import DailyChallengeAttempt from "../models/DailyChallengeAttempt.js";
import PollVote from "../models/PollVote.js";
import { getPollResults, syncCommunityStatuses } from "./community.service.js";

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const cleanText = (value, maxLength, label, required = true) => {
  const text = String(value ?? "").trim();
  if (required && !text) throw httpError(`${label} is required.`);
  if (text.length > maxLength) throw httpError(`${label} is too long.`);
  return text;
};

const parseDate = (value, label, required = false) => {
  if (!value) {
    if (required) throw httpError(`${label} is required.`);
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(`${label} is invalid.`);
  return date;
};

const normalizeStatusAndDates = (payload) => {
  const requestedStatus = ["draft", "scheduled", "live", "ended"].includes(
    payload.status,
  )
    ? payload.status
    : "draft";

  if (requestedStatus === "draft") {
    return {
      status: "draft",
      publishAt: payload.publishAt ? parseDate(payload.publishAt, "Publish time") : null,
      expiresAt: payload.expiresAt ? parseDate(payload.expiresAt, "Expiry time") : null,
    };
  }

  if (requestedStatus === "ended") {
    return {
      status: "ended",
      publishAt: payload.publishAt ? parseDate(payload.publishAt, "Publish time") : null,
      expiresAt: payload.expiresAt ? parseDate(payload.expiresAt, "Expiry time") : new Date(),
    };
  }

  const now = new Date();
  const publishAt =
    requestedStatus === "live" && !payload.publishAt
      ? now
      : parseDate(payload.publishAt, "Publish time", true);
  const expiresAt = parseDate(payload.expiresAt, "Expiry time", true);

  if (expiresAt <= publishAt) {
    throw httpError("Expiry time must be after the publish time.");
  }

  return {
    status: publishAt > now ? "scheduled" : "live",
    publishAt,
    expiresAt,
  };
};

const ensureNoChallengeOverlap = async ({ publishAt, expiresAt, ignoreId = null }) => {
  if (!publishAt || !expiresAt) return;

  const filter = {
    status: { $in: ["scheduled", "live"] },
    publishAt: { $lt: expiresAt },
    expiresAt: { $gt: publishAt },
  };

  if (ignoreId) filter._id = { $ne: ignoreId };

  const conflict = await DailyChallenge.findOne(filter).select("question publishAt expiresAt").lean();
  if (conflict) {
    throw httpError(
      "Another daily challenge already occupies part of this publish window.",
      409,
    );
  }
};

const serializeAdminChallenge = async (challenge) => {
  const attempts = await DailyChallengeAttempt.aggregate([
    { $match: { challenge: challenge._id } },
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        correct: { $sum: { $cond: ["$isCorrect", 1, 0] } },
      },
    },
  ]);

  const stats = attempts[0] || { attempts: 0, correct: 0 };

  return {
    id: String(challenge._id),
    question: challenge.question,
    options: challenge.options.map((option) => option.text),
    correctOptionIndex: Number(challenge.correctOptionIndex),
    category: challenge.category,
    difficulty: challenge.difficulty,
    explanation: challenge.explanation || "",
    xpReward: Number(challenge.xpReward || 0),
    fluxGemReward: Number(challenge.fluxGemReward || 0),
    status: challenge.status,
    publishAt: challenge.publishAt,
    expiresAt: challenge.expiresAt,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
    stats: {
      attempts: Number(stats.attempts || 0),
      correct: Number(stats.correct || 0),
      accuracy:
        Number(stats.attempts || 0) > 0
          ? Math.round((Number(stats.correct || 0) / Number(stats.attempts)) * 100)
          : 0,
    },
  };
};

const challengePayload = (payload) => {
  const options = Array.isArray(payload.options)
    ? payload.options.map((option) => cleanText(option, 240, "Challenge option"))
    : [];

  if (options.length !== 4) throw httpError("Provide exactly four challenge options.");
  if (new Set(options.map((option) => option.toLowerCase())).size !== 4) {
    throw httpError("Challenge options must be unique.");
  }

  const correctOptionIndex = Number(payload.correctOptionIndex);
  if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
    throw httpError("Select the correct challenge answer.");
  }

  const xpReward = Number(payload.xpReward ?? 20);
  const fluxGemReward = Number(payload.fluxGemReward ?? 5);

  if (!Number.isInteger(xpReward) || xpReward < 0 || xpReward > 1000) {
    throw httpError("XP reward must be a whole number from 0 to 1000.");
  }
  if (!Number.isInteger(fluxGemReward) || fluxGemReward < 0 || fluxGemReward > 500) {
    throw httpError("FluxGem reward must be a whole number from 0 to 500.");
  }

  return {
    question: cleanText(payload.question, 1000, "Question"),
    options: options.map((text) => ({ text })),
    correctOptionIndex,
    category: cleanText(payload.category || "General Knowledge", 80, "Category"),
    difficulty: ["easy", "medium", "hard"].includes(payload.difficulty)
      ? payload.difficulty
      : "medium",
    explanation: cleanText(payload.explanation || "", 2000, "Explanation", false),
    xpReward,
    fluxGemReward,
    ...normalizeStatusAndDates(payload),
  };
};

export const listAdminChallenges = async () => {
  await syncCommunityStatuses();
  const challenges = await DailyChallenge.find()
    .select("+correctOptionIndex")
    .sort({ publishAt: -1, createdAt: -1 })
    .lean();
  return Promise.all(challenges.map(serializeAdminChallenge));
};

export const createAdminChallenge = async ({ adminId, payload }) => {
  const data = challengePayload(payload);
  if (["scheduled", "live"].includes(data.status)) {
    await ensureNoChallengeOverlap(data);
  }

  const challenge = await DailyChallenge.create({ ...data, createdBy: adminId });
  return serializeAdminChallenge(challenge.toObject());
};

export const updateAdminChallenge = async ({ challengeId, payload }) => {
  if (!mongoose.isValidObjectId(challengeId)) throw httpError("Invalid challenge.");

  const existing = await DailyChallenge.findById(challengeId).select("+correctOptionIndex");
  if (!existing) throw httpError("Challenge not found.", 404);

  const data = challengePayload({
    question: payload.question ?? existing.question,
    options: payload.options ?? existing.options.map((option) => option.text),
    correctOptionIndex: payload.correctOptionIndex ?? existing.correctOptionIndex,
    category: payload.category ?? existing.category,
    difficulty: payload.difficulty ?? existing.difficulty,
    explanation: payload.explanation ?? existing.explanation,
    xpReward: payload.xpReward ?? existing.xpReward,
    fluxGemReward: payload.fluxGemReward ?? existing.fluxGemReward,
    status: payload.status ?? existing.status,
    publishAt: payload.publishAt ?? existing.publishAt,
    expiresAt: payload.expiresAt ?? existing.expiresAt,
  });

  if (["scheduled", "live"].includes(data.status)) {
    await ensureNoChallengeOverlap({ ...data, ignoreId: existing._id });
  }

  Object.assign(existing, data);
  await existing.save();
  return serializeAdminChallenge(existing.toObject());
};

export const deleteAdminChallenge = async (challengeId) => {
  if (!mongoose.isValidObjectId(challengeId)) throw httpError("Invalid challenge.");

  const attempts = await DailyChallengeAttempt.countDocuments({ challenge: challengeId });
  if (attempts > 0) {
    throw httpError(
      "Challenges with user attempts are retained for progression history. End it instead of deleting it.",
      409,
    );
  }

  const deleted = await DailyChallenge.findByIdAndDelete(challengeId);
  if (!deleted) throw httpError("Challenge not found.", 404);
  return { id: String(deleted._id) };
};

const pollPayload = (payload) => {
  const options = Array.isArray(payload.options)
    ? payload.options
        .map((option) => cleanText(option, 240, "Poll option", false))
        .filter(Boolean)
    : [];

  if (options.length < 2 || options.length > 6) {
    throw httpError("Provide between two and six poll options.");
  }
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    throw httpError("Poll options must be unique.");
  }

  return {
    question: cleanText(payload.question, 1000, "Poll question"),
    options: options.map((text) => ({ text })),
    ...normalizeStatusAndDates(payload),
  };
};

const serializeAdminPoll = async (poll) => ({
  id: String(poll._id),
  question: poll.question,
  options: poll.options.map((option) => ({ id: String(option._id), text: option.text })),
  status: poll.status,
  publishAt: poll.publishAt,
  expiresAt: poll.expiresAt,
  createdAt: poll.createdAt,
  updatedAt: poll.updatedAt,
  results: await getPollResults(poll),
});

export const listAdminPolls = async () => {
  await syncCommunityStatuses();
  const polls = await CommunityPoll.find().sort({ publishAt: -1, createdAt: -1 }).lean();
  return Promise.all(polls.map(serializeAdminPoll));
};

export const createAdminPoll = async ({ adminId, payload }) => {
  const poll = await CommunityPoll.create({ ...pollPayload(payload), createdBy: adminId });
  return serializeAdminPoll(poll.toObject());
};

export const updateAdminPoll = async ({ pollId, payload }) => {
  if (!mongoose.isValidObjectId(pollId)) throw httpError("Invalid poll.");

  const existing = await CommunityPoll.findById(pollId);
  if (!existing) throw httpError("Poll not found.", 404);

  const voteCount = await PollVote.countDocuments({ poll: existing._id });
  const optionsChanged = Array.isArray(payload.options);
  if (voteCount > 0 && optionsChanged) {
    const incoming = payload.options.map((option) => String(option).trim());
    const current = existing.options.map((option) => option.text);
    if (JSON.stringify(incoming) !== JSON.stringify(current)) {
      throw httpError("Poll options cannot be changed after voting has started.", 409);
    }
  }

  const data = pollPayload({
    question: payload.question ?? existing.question,
    options: payload.options ?? existing.options.map((option) => option.text),
    status: payload.status ?? existing.status,
    publishAt: payload.publishAt ?? existing.publishAt,
    expiresAt: payload.expiresAt ?? existing.expiresAt,
  });

  existing.question = data.question;
  if (voteCount === 0) existing.options = data.options;
  existing.status = data.status;
  existing.publishAt = data.publishAt;
  existing.expiresAt = data.expiresAt;
  await existing.save();

  await deleteCacheKeys(`studyflux:poll:${existing._id}:results`);
  return serializeAdminPoll(existing.toObject());
};

export const deleteAdminPoll = async (pollId) => {
  if (!mongoose.isValidObjectId(pollId)) throw httpError("Invalid poll.");

  const votes = await PollVote.countDocuments({ poll: pollId });
  if (votes > 0) {
    throw httpError(
      "Polls with votes are retained as community history. End it instead of deleting it.",
      409,
    );
  }

  const deleted = await CommunityPoll.findByIdAndDelete(pollId);
  if (!deleted) throw httpError("Poll not found.", 404);
  await deleteCacheKeys(`studyflux:poll:${pollId}:results`);
  return { id: String(deleted._id) };
};

export const getAdminCommunityOverview = async () => {
  await syncCommunityStatuses();

  const [
    challengeStatusCounts,
    pollStatusCounts,
    totalAttempts,
    correctAttempts,
    totalVotes,
  ] = await Promise.all([
    DailyChallenge.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    CommunityPoll.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    DailyChallengeAttempt.countDocuments(),
    DailyChallengeAttempt.countDocuments({ isCorrect: true }),
    PollVote.countDocuments(),
  ]);

  const statusMap = (rows) =>
    Object.fromEntries(rows.map((row) => [row._id, Number(row.count || 0)]));

  const challengeCounts = statusMap(challengeStatusCounts);
  const pollCounts = statusMap(pollStatusCounts);

  return {
    challenges: {
      live: challengeCounts.live || 0,
      scheduled: challengeCounts.scheduled || 0,
      draft: challengeCounts.draft || 0,
      ended: challengeCounts.ended || 0,
      totalAttempts,
      correctAttempts,
      accuracy:
        totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    },
    polls: {
      live: pollCounts.live || 0,
      scheduled: pollCounts.scheduled || 0,
      draft: pollCounts.draft || 0,
      ended: pollCounts.ended || 0,
      totalVotes,
    },
  };
};
