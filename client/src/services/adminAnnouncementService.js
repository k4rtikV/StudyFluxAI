import api from "./authService";

export const getAdminAnnouncements = async () => {
  const response = await api.get("/admin/announcements");
  return response.data;
};

export const createAdminAnnouncement = async (payload) => {
  const response = await api.post("/admin/announcements", payload);
  return response.data;
};

export const updateAdminAnnouncement = async (id, payload) => {
  const response = await api.patch(`/admin/announcements/${id}`, payload);
  return response.data;
};

export const publishAdminAnnouncement = async (id) => {
  const response = await api.post(`/admin/announcements/${id}/publish`);
  return response.data;
};

export const archiveAdminAnnouncement = async (id) => {
  const response = await api.post(`/admin/announcements/${id}/archive`);
  return response.data;
};

export const deleteAdminAnnouncement = async (id) => {
  const response = await api.delete(`/admin/announcements/${id}`);
  return response.data;
};
