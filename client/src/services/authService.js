import axios from "axios";

import { getBrowserTimeZone } from "../utils/timezone";

const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
  timeout: 180000,
  maxContentLength: 20 * 1024 * 1024,
  maxBodyLength: 20 * 1024 * 1024,
  allowAbsoluteUrls: false,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.response?.data?.code;
    if (
      typeof window !== "undefined" &&
      ["SESSION_REVOKED", "INVALID_SESSION"].includes(code)
    ) {
      window.dispatchEvent(
        new CustomEvent("studyflux:session-revoked", { detail: { code } }),
      );
    }
    return Promise.reject(error);
  },
);

export const registerUser = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

export const loginUser = async (payload) => {
  const response = await api.post("/auth/login", {
    ...payload,
    timezone: getBrowserTimeZone(),
  });
  return response.data;
};

export const googleAuthUser = async (credential) => {
  const response = await api.post("/auth/google", {
    credential,
    timezone: getBrowserTimeZone(),
  });
  return response.data;
};

export const verifyEmail = async (payload) => {
  const response = await api.post("/auth/verify-email", {
    ...payload,
    timezone: getBrowserTimeZone(),
  });
  return response.data;
};

export const resendVerificationCode = async (email, registrationToken) => {
  const response = await api.post("/auth/resend-verification", {
    email,
    registrationToken,
  });
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (payload) => {
  const response = await api.post("/auth/reset-password", payload);
  return response.data;
};

export const changePassword = async (payload) => {
  const response = await api.post("/auth/change-password", payload);
  return response.data;
};

export const linkGoogleAccount = async ({ credential, currentPassword }) => {
  const response = await api.post("/auth/link-google", {
    credential,
    currentPassword,
  });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const syncUserTimezone = async () => {
  const response = await api.patch("/auth/timezone", {
    timezone: getBrowserTimeZone(),
  });
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

export default api;
