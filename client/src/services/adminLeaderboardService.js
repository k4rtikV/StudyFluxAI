import api from "./authService";

export const getAdminLeaderboard = async ({ board = "overall", limit = 50 } = {}) => {
  const response = await api.get("/admin/leaderboard", { params: { board, limit } });
  return response.data;
};

export const rebuildAdminLeaderboard = async () => {
  const response = await api.post("/admin/leaderboard/rebuild");
  return response.data;
};
