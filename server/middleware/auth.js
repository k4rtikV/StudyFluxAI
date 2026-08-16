import User from "../models/User.js";
import { verifyAuthToken } from "../utils/jwt.js";

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
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Your session has expired. Please sign in again.",
      });
    }

    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Your session is no longer valid.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Verify your email before continuing.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};