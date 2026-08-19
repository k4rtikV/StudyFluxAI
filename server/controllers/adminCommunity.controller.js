import {
  createAdminChallenge,
  createAdminPoll,
  deleteAdminChallenge,
  deleteAdminPoll,
  getAdminCommunityOverview,
  listAdminChallenges,
  listAdminPolls,
  updateAdminChallenge,
  updateAdminPoll,
} from "../services/adminCommunity.service.js";
import {
  generateAdminChallengeDraft,
  generateAdminPollDraft,
} from "../services/adminCommunityAi.service.js";

export const generateChallengeDraft = async (req, res, next) => {
  try {
    const result = await generateAdminChallengeDraft(req.body || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const generatePollDraft = async (req, res, next) => {
  try {
    const result = await generateAdminPollDraft(req.body || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getCommunityOverview = async (req, res, next) => {
  try {
    const overview = await getAdminCommunityOverview();
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
};

export const getChallenges = async (req, res, next) => {
  try {
    const challenges = await listAdminChallenges();
    return res.status(200).json({ success: true, data: { challenges } });
  } catch (error) {
    next(error);
  }
};

export const createChallenge = async (req, res, next) => {
  try {
    const challenge = await createAdminChallenge({
      adminId: req.user._id,
      payload: req.body || {},
    });
    return res.status(201).json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const updateChallenge = async (req, res, next) => {
  try {
    const challenge = await updateAdminChallenge({
      challengeId: req.params.challengeId,
      payload: req.body || {},
    });
    return res.status(200).json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const deleteChallenge = async (req, res, next) => {
  try {
    const deleted = await deleteAdminChallenge(req.params.challengeId);
    return res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    next(error);
  }
};

export const getPolls = async (req, res, next) => {
  try {
    const polls = await listAdminPolls();
    return res.status(200).json({ success: true, data: { polls } });
  } catch (error) {
    next(error);
  }
};

export const createPoll = async (req, res, next) => {
  try {
    const poll = await createAdminPoll({
      adminId: req.user._id,
      payload: req.body || {},
    });
    return res.status(201).json({ success: true, data: { poll } });
  } catch (error) {
    next(error);
  }
};

export const updatePoll = async (req, res, next) => {
  try {
    const poll = await updateAdminPoll({
      pollId: req.params.pollId,
      payload: req.body || {},
    });
    return res.status(200).json({ success: true, data: { poll } });
  } catch (error) {
    next(error);
  }
};

export const deletePoll = async (req, res, next) => {
  try {
    const deleted = await deleteAdminPoll(req.params.pollId);
    return res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    next(error);
  }
};
