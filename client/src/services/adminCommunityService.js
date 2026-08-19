import api from "./authService";

export const getAdminCommunityOverview = async () => {
  const response = await api.get("/admin/community/overview");
  return response.data;
};

export const getAdminChallenges = async () => {
  const response = await api.get("/admin/community/challenges");
  return response.data;
};

export const createAdminChallenge = async (payload) => {
  const response = await api.post("/admin/community/challenges", payload);
  return response.data;
};

export const updateAdminChallenge = async (challengeId, payload) => {
  const response = await api.patch(
    `/admin/community/challenges/${challengeId}`,
    payload,
  );
  return response.data;
};

export const deleteAdminChallenge = async (challengeId) => {
  const response = await api.delete(`/admin/community/challenges/${challengeId}`);
  return response.data;
};

export const getAdminPolls = async () => {
  const response = await api.get("/admin/community/polls");
  return response.data;
};

export const createAdminPoll = async (payload) => {
  const response = await api.post("/admin/community/polls", payload);
  return response.data;
};

export const updateAdminPoll = async (pollId, payload) => {
  const response = await api.patch(`/admin/community/polls/${pollId}`, payload);
  return response.data;
};

export const deleteAdminPoll = async (pollId) => {
  const response = await api.delete(`/admin/community/polls/${pollId}`);
  return response.data;
};

export const generateAdminChallengeDraft = async (payload) => {
  const response = await api.post("/admin/community/challenges/ai-draft", payload);
  return response.data;
};

export const generateAdminPollDraft = async (payload) => {
  const response = await api.post("/admin/community/polls/ai-draft", payload);
  return response.data;
};
