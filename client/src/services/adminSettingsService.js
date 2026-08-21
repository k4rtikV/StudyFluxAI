import api from "./authService";

export const getAdminSettings = async () => {
  const response = await api.get("/admin/settings");
  return response.data;
};

export const updateAdminSettings = async (payload) => {
  const response = await api.patch("/admin/settings", payload);
  return response.data;
};
