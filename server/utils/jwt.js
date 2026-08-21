import jwt from "jsonwebtoken";

import { getNumberEnv } from "../config/env.js";

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from environment variables.");
  }

  return process.env.JWT_SECRET;
};

export const generateAuthToken = (user) => {
  return jwt.sign(
    {
      role: user.role,
      av: Number(user.authVersion || 0),
    },
    getJwtSecret(),
    {
      subject: user._id.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: "studyfluxai",
      audience: "studyfluxai-web",
    },
  );
};

export const verifyAuthToken = (token) => {
  return jwt.verify(token, getJwtSecret(), {
    issuer: "studyfluxai",
    audience: "studyfluxai-web",
  });
};

export const setAuthCookie = (res, token) => {
  const cookieDays = getNumberEnv("JWT_COOKIE_DAYS", 7);

  res.cookie("studyflux_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie("studyflux_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};