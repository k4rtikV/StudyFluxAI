import api from "./authService";

export const getLeaderboard = async ({ board = "overall", limit = 25 } = {}) => {
  const response = await api.get("/leaderboard", { params: { board, limit } });
  return response.data;
};
