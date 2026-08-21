import express from "express";

import {
  changePassword,
  forgotPassword,
  getMe,
  googleAuth,
  linkGoogle,
  login,
  logout,
  register,
  resendVerificationCode,
  resetPassword,
  syncTimezone,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/authRateLimit.js";

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

router.post(
  "/register",
  authRateLimit({
    bucket: "register",
    limit: 12,
    accountLimit: 4,
    windowMs: 15 * 60 * 1000,
  }),
  register,
);
router.post(
  "/login",
  authRateLimit({
    bucket: "login",
    limit: 30,
    accountLimit: 10,
    windowMs: 15 * 60 * 1000,
  }),
  login,
);
router.post(
  "/google",
  authRateLimit({ bucket: "google", limit: 20, windowMs: 15 * 60 * 1000 }),
  googleAuth,
);
router.post(
  "/verify-email",
  authRateLimit({ bucket: "verify-email", limit: 15, windowMs: 15 * 60 * 1000, includeEmail: true }),
  verifyEmail,
);
router.post(
  "/resend-verification",
  authRateLimit({ bucket: "resend-verification", limit: 6, windowMs: 15 * 60 * 1000, includeEmail: true }),
  resendVerificationCode,
);
router.post(
  "/forgot-password",
  authRateLimit({ bucket: "forgot-password", limit: 6, windowMs: 60 * 60 * 1000, includeEmail: true }),
  forgotPassword,
);
router.post(
  "/reset-password",
  authRateLimit({ bucket: "reset-password", limit: 12, windowMs: 15 * 60 * 1000, includeEmail: true }),
  resetPassword,
);

router.get("/me", protect, getMe);
router.patch("/timezone", protect, syncTimezone);
router.post(
  "/change-password",
  protect,
  authRateLimit({ bucket: "change-password", limit: 8, windowMs: 15 * 60 * 1000 }),
  changePassword,
);
router.post(
  "/link-google",
  protect,
  authRateLimit({ bucket: "link-google", limit: 8, windowMs: 15 * 60 * 1000 }),
  linkGoogle,
);
router.post("/logout", logout);

export default router;