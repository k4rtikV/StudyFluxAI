import express from "express";

import {
  getMe,
  googleAuth,
  login,
  logout,
  register,
  resendVerificationCode,
  verifyEmail,
} from "../controllers/auth.controller.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/google", googleAuth);

router.post("/verify-email", verifyEmail);

router.post(
  "/resend-verification",
  resendVerificationCode,
);

router.get("/me", protect, getMe);

router.post("/logout", protect, logout);

export default router;