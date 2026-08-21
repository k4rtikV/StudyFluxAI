import api from "./authService";

export const getSupportConfig = async () => {
  const response = await api.get("/support/config");
  return response.data;
};

export const sendSupportRequest = async (payload) => {
  const response = await api.post("/support/requests", payload);
  return response.data;
};
