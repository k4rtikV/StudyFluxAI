import api from "./authService";

export const getAdminUserOverview = async () => {
  const response = await api.get("/admin/users/overview");
  return response.data;
};

export const getAdminUsers = async ({
  query = "",
  status = "all",
  provider = "all",
  page = 1,
  limit = 12,
} = {}) => {
  const response = await api.get("/admin/users", {
    params: {
      q: query || undefined,
      status,
      provider,
      page,
      limit,
    },
  });
  return response.data;
};

export const getAdminUser = async (userId) => {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data;
};

export const setAdminUserActiveStatus = async (userId, isActive) => {
  const response = await api.patch(`/admin/users/${userId}/status`, { isActive });
  return response.data;
};
