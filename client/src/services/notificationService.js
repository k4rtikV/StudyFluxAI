import api from "./authService";

export const getNotifications = async ({ limit = 20, unreadOnly = false } = {}) => {
  const response = await api.get("/notifications", { params: { limit, unreadOnly } });
  return response.data;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};
