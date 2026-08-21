import User from "../models/User.js";
import { clearAuthCookie, verifyAuthToken } from "../utils/jwt.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.studyflux_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please sign in to continue.",
      });
    }

    let payload;

    try {
      payload = verifyAuthToken(token);
    } catch {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Your session has expired. Please sign in again.",
      });
    }

    const user = await User.findById(payload.sub).select("+authVersion");

    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Your session is no longer valid.",
      });
    }

    const tokenAuthVersion = Number(payload.av ?? 0);
    const currentAuthVersion = Number(user.authVersion ?? 0);

    if (tokenAuthVersion !== currentAuthVersion) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "Your sign-in session was revoked after an account security change. Please sign in again.",
      });
    }

    if (!user.isEmailVerified) {
      clearAuthCookie(res);
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before continuing.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
