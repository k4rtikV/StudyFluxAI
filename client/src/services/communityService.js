import api from "./authService";

export const getDailyChallenge = async () => {
  const response = await api.get("/community/daily-challenge");
  return response.data;
};

export const answerDailyChallenge = async (challengeId, selectedOptionIndex) => {
  const response = await api.post(
    `/community/daily-challenge/${challengeId}/answer`,
    { selectedOptionIndex },
  );
  return response.data;
};

export const getCommunityPolls = async () => {
  const response = await api.get("/community/polls");
  return response.data;
};

export const voteCommunityPoll = async (pollId, optionId) => {
  const response = await api.post(`/community/polls/${pollId}/vote`, {
    optionId,
  });
  return response.data;
};
