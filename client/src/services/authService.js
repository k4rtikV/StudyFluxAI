import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

export const registerUser = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

export const loginUser = async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data;
};

export const googleAuthUser = async (credential) => {
  const response = await api.post("/auth/google", {
    credential,
  });

  return response.data;
};

export const verifyEmail = async (payload) => {
  const response = await api.post("/auth/verify-email", payload);
  return response.data;
};

export const resendVerificationCode = async (email) => {
  const response = await api.post("/auth/resend-verification", {
    email,
  });

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

export default api;