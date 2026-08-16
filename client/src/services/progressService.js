import api from "./authService";

export const getProgressOverview = async () => {
  const response = await api.get("/progress/overview");

  return response.data;
};
