import {
  getActiveCommunityPolls,
  getTodayChallenge,
  submitDailyChallenge,
  voteInCommunityPoll,
} from "../services/community.service.js";

export const getDailyChallenge = async (req, res, next) => {
  try {
    const challenge = await getTodayChallenge(req.user._id);
    return res.status(200).json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const answerDailyChallenge = async (req, res, next) => {
  try {
    const result = await submitDailyChallenge({
      userId: req.user._id,
      challengeId: req.params.challengeId,
      selectedOptionIndex: req.body?.selectedOptionIndex,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getCommunityPolls = async (req, res, next) => {
  try {
    const polls = await getActiveCommunityPolls(req.user._id);
    return res.status(200).json({ success: true, data: { polls } });
  } catch (error) {
    next(error);
  }
};

export const voteCommunityPoll = async (req, res, next) => {
  try {
    const result = await voteInCommunityPoll({
      userId: req.user._id,
      pollId: req.params.pollId,
      optionId: req.body?.optionId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
