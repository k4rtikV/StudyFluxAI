import api from "./authService";

export const getUserSettings = async () => {
  const response = await api.get("/settings");
  return response.data;
};

export const updateUserSettings = async (payload) => {
  const response = await api.patch("/settings", payload);
  return response.data;
};
