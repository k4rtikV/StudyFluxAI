import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";

import { sendVerificationEmail } from "../services/email.service.js";
import { verifyGoogleCredential } from "../services/googleAuth.service.js";

import {
  createVerificationCode,
  invalidateOtherVerificationCodes,
} from "../services/verificationCode.service.js";

import {
  isValidEmail,
  normalizeEmail,
  validateLoginInput,
  validateOtpInput,
  validateRegistrationInput,
} from "../utils/authValidation.js";

import {
  clearAuthCookie,
  generateAuthToken,
  setAuthCookie,
} from "../utils/jwt.js";

import {
  OTP_RESEND_COOLDOWN_SECONDS,
  verifyOtpHash,
} from "../utils/otp.js";
import {
  isValidTimeZone,
  normalizeTimeZone,
} from "../utils/timezone.js";

const applyReportedTimeZone = (user, reportedTimeZone) => {
  const candidate = String(reportedTimeZone || "").trim();

  if (!candidate || !isValidTimeZone(candidate)) {
    return false;
  }

  // Authentication captures the learner's home/preferred timezone once.
  // Future timezone changes should be explicit so historical streak days are
  // not silently reinterpreted simply because the learner is travelling.
  if (isValidTimeZone(user.timezone)) {
    return false;
  }

  user.timezone = candidate;
  user.timezoneUpdatedAt = new Date();
  return true;
};

const serializeAuthUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  timezone: normalizeTimeZone(user.timezone),
  timezoneConfigured: isValidTimeZone(user.timezone),
  timezoneUpdatedAt: user.timezoneUpdatedAt || null,
  fluxGems: Number(user.fluxGems || 0),
  isEmailVerified: user.isEmailVerified,
  learningProfileCompleted: Boolean(user.learningProfileCompleted),
  authProviders: user.authProviders,
});

const getReservedAdminEmail = () =>
  normalizeEmail(process.env.ADMIN_SEED_EMAIL);

const isReservedAdminEmail = (email) => {
  const reservedEmail = getReservedAdminEmail();
  return Boolean(reservedEmail) && normalizeEmail(email) === reservedEmail;
};

const getAuthNextStep = (user) => {
  if (user?.role === "admin") {
    return "admin_portal";
  }

  return user?.learningProfileCompleted === true
    ? "dashboard"
    : "learning_profile";
};

export const register = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
    } = req.body;

    const validation = validateRegistrationInput({
      fullName,
      email,
      password,
      confirmPassword,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors: validation.errors,
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = fullName.trim();

    if (isReservedAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_RESERVED",
        message:
          "This email address is reserved for StudyFluxAI administration.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        return res.status(409).json({
          success: false,
          code: "EMAIL_PENDING_VERIFICATION",
          message:
            "This email is already awaiting verification.",
        });
      }

      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message:
          "An account with this email already exists.",
      });
    }

    await User.create({
      fullName: normalizedName,
      email: normalizedEmail,
      password,
      authProviders: ["local"],
      isEmailVerified: false,
      learningProfileCompleted: false,
    });

    try {
      const { otp, verificationCode } =
        await createVerificationCode({
          email: normalizedEmail,
          purpose: "email_verification",
        });

      try {
        await sendVerificationEmail({
          email: normalizedEmail,
          fullName: normalizedName,
          otp,
        });
      } catch (emailError) {
        await VerificationCode.deleteOne({
          _id: verificationCode._id,
        });

        console.error(
          "Verification email delivery failed:",
          emailError.message,
        );

        return res.status(503).json({
          success: false,
          code: "VERIFICATION_EMAIL_FAILED",
          message:
            "Your account was created, but we couldn't send the verification email. Please try resending the code.",
        });
      }

      return res.status(201).json({
        success: true,
        message:
          "Account created. Check your email for the verification code.",
        data: {
          email: normalizedEmail,
          verificationRequired: true,
        },
      });
    } catch (verificationError) {
      return next(verificationError);
    }
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message:
          "An account with this email already exists.",
      });
    }

    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const validation = validateLoginInput({
      email,
      password,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Please correct the highlighted fields.",
        errors: validation.errors,
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        code: "PASSWORD_LOGIN_UNAVAILABLE",
        message:
          "Password sign-in is not available for this account.",
      });
    }

    const passwordMatches =
      await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "This account is currently unavailable.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Verify your email before signing in.",
        data: {
          email: user.email,
        },
      });
    }

    applyReportedTimeZone(user, req.body.timezone);
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateAuthToken(user);

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Signed in successfully.",
      data: {
        user: serializeAuthUser(user),
        nextStep: getAuthNextStep(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (
  req,
  res,
  next,
) => {
  try {
    const credential =
      typeof req.body.credential === "string"
        ? req.body.credential.trim()
        : "";

    if (!credential) {
      return res.status(400).json({
        success: false,
        code: "GOOGLE_CREDENTIAL_REQUIRED",
        message:
          "Google authentication information is required.",
      });
    }

    let googleProfile;

    try {
      googleProfile =
        await verifyGoogleCredential(
          credential,
        );
    } catch (error) {
      console.error(
        "Google credential verification failed:",
        error.message,
      );

      return res.status(401).json({
        success: false,
        code: "INVALID_GOOGLE_CREDENTIAL",
        message:
          "Google sign-in could not be verified. Please try again.",
      });
    }

    const {
      googleId,
      email,
      fullName,
      avatar,
      googleIsAuthoritativeForEmail,
    } = googleProfile;

    if (isReservedAdminEmail(email)) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_PASSWORD_REQUIRED",
        message:
          "Admin accounts must sign in with their StudyFluxAI admin password.",
      });
    }

    let user = await User.findOne({
      googleId,
    });

    if (user) {
      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          code: "ADMIN_PASSWORD_REQUIRED",
          message:
            "Admin accounts must sign in with their StudyFluxAI admin password.",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_DISABLED",
          message:
            "This account is currently unavailable.",
        });
      }

      if (
        !user.authProviders.includes(
          "google",
        )
      ) {
        user.authProviders.push("google");
      }

      user.isEmailVerified = true;
      applyReportedTimeZone(user, req.body.timezone);
      user.lastLoginAt = new Date();

      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      await user.save();
    } else {
      user = await User.findOne({
        email,
      }).select("+googleId");

      if (user) {
        if (user.role === "admin") {
          return res.status(403).json({
            success: false,
            code: "ADMIN_PASSWORD_REQUIRED",
            message:
              "Admin accounts must sign in with their StudyFluxAI admin password.",
          });
        }

        if (!user.isActive) {
          return res.status(403).json({
            success: false,
            code: "ACCOUNT_DISABLED",
            message:
              "This account is currently unavailable.",
          });
        }

        if (
          user.googleId &&
          user.googleId !== googleId
        ) {
          return res.status(409).json({
            success: false,
            code:
              "GOOGLE_ACCOUNT_MISMATCH",
            message:
              "This StudyFluxAI account is already linked to another Google account.",
          });
        }

        if (
          !user.googleId &&
          !googleIsAuthoritativeForEmail
        ) {
          return res.status(409).json({
            success: false,
            code:
              "GOOGLE_LINK_REQUIRES_PASSWORD",
            message:
              "For security, sign in with your StudyFluxAI password before linking Google to this account.",
          });
        }

        user.googleId = googleId;

        if (
          !user.authProviders.includes(
            "google",
          )
        ) {
          user.authProviders.push(
            "google",
          );
        }

        user.isEmailVerified = true;
        applyReportedTimeZone(user, req.body.timezone);
        user.lastLoginAt = new Date();

        if (!user.avatar && avatar) {
          user.avatar = avatar;
        }

        await user.save();
      } else {
        const reportedTimeZone = String(req.body.timezone || "").trim();
        const hasReportedTimeZone = isValidTimeZone(reportedTimeZone);

        user = await User.create({
          fullName,
          email,
          googleId,
          authProviders: ["google"],
          isEmailVerified: true,
          learningProfileCompleted: false,
          avatar,
          timezone: hasReportedTimeZone ? reportedTimeZone : "",
          timezoneUpdatedAt: hasReportedTimeZone ? new Date() : null,
          lastLoginAt: new Date(),
        });
      }
    }

    const token =
      generateAuthToken(user);

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message:
        "Signed in with Google successfully.",
      data: {
        user: serializeAuthUser(user),

        nextStep: getAuthNextStep(user),
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code:
          "GOOGLE_ACCOUNT_CONFLICT",
        message:
          "This Google account is already associated with another StudyFluxAI account.",
      });
    }

    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp ?? "").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
        errors: {
          email: "Enter a valid email address.",
        },
      });
    }

    const otpValidation = validateOtpInput(otp);

    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        message: otpValidation.message,
        errors: {
          otp: otpValidation.message,
        },
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VERIFICATION_REQUEST",
        message: "Unable to verify this account.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_VERIFIED",
        message: "This email has already been verified. Please sign in.",
      });
    }

    const verificationCode = await VerificationCode.findOne({
      email,
      purpose: "email_verification",
      usedAt: null,
    })
      .sort({ createdAt: -1 })
      .select("+codeHash");

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        code: "OTP_INVALID_OR_EXPIRED",
        message:
          "This verification code is invalid or has expired. Request a new code.",
      });
    }

    const now = new Date();

    if (verificationCode.expiresAt <= now) {
      verificationCode.usedAt = now;
      await verificationCode.save();

      return res.status(410).json({
        success: false,
        code: "OTP_EXPIRED",
        message:
          "This verification code has expired. Request a new code.",
      });
    }

    if (
      verificationCode.attempts >=
      verificationCode.maxAttempts
    ) {
      return res.status(429).json({
        success: false,
        code: "OTP_ATTEMPTS_EXCEEDED",
        message:
          "Too many incorrect attempts. Request a new verification code.",
      });
    }

    const otpMatches = verifyOtpHash(
      otp,
      verificationCode.codeHash,
    );

    if (!otpMatches) {
      verificationCode.attempts += 1;

      const attemptsRemaining = Math.max(
        verificationCode.maxAttempts -
          verificationCode.attempts,
        0,
      );

      if (attemptsRemaining === 0) {
        verificationCode.usedAt = now;
      }

      await verificationCode.save();

      return res.status(
        attemptsRemaining === 0 ? 429 : 400,
      ).json({
        success: false,
        code:
          attemptsRemaining === 0
            ? "OTP_ATTEMPTS_EXCEEDED"
            : "OTP_INCORRECT",
        message:
          attemptsRemaining === 0
            ? "Too many incorrect attempts. Request a new verification code."
            : "Incorrect verification code.",
        data: {
          attemptsRemaining,
        },
      });
    }

    verificationCode.usedAt = now;
    await verificationCode.save();

    await invalidateOtherVerificationCodes({
      email,
      purpose: "email_verification",
      exceptId: verificationCode._id,
    });

    user.isEmailVerified = true;
    applyReportedTimeZone(user, req.body.timezone);
    user.lastLoginAt = now;

    await user.save();

    const token = generateAuthToken(user);

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      data: {
        user: serializeAuthUser(user),

        nextStep: getAuthNextStep(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationCode = async (
  req,
  res,
  next,
) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message:
          "No pending account was found for this email.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_VERIFIED",
        message:
          "This email has already been verified.",
      });
    }

    const now = new Date();

    const latestCode = await VerificationCode.findOne({
      email,
      purpose: "email_verification",
      usedAt: null,
    }).sort({
      createdAt: -1,
    });

    if (
      latestCode &&
      latestCode.resendAvailableAt > now
    ) {
      const retryAfter = Math.ceil(
        (latestCode.resendAvailableAt.getTime() -
          now.getTime()) /
          1000,
      );

      res.set("Retry-After", String(retryAfter));

      return res.status(429).json({
        success: false,
        code: "OTP_RESEND_COOLDOWN",
        message: `Please wait ${retryAfter} seconds before requesting another code.`,
        data: {
          retryAfter,
        },
      });
    }

    const { otp, verificationCode } =
      await createVerificationCode({
        email,
        purpose: "email_verification",
      });

    try {
      await sendVerificationEmail({
        email,
        fullName: user.fullName,
        otp,
      });
    } catch (emailError) {
      await VerificationCode.deleteOne({
        _id: verificationCode._id,
      });

      console.error(
        "Verification email resend failed:",
        emailError.message,
      );

      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_FAILED",
        message:
          "We couldn't send a new verification code. Please try again.",
      });
    }

    await invalidateOtherVerificationCodes({
      email,
      purpose: "email_verification",
      exceptId: verificationCode._id,
    });

    return res.status(200).json({
      success: true,
      message:
        "A new verification code has been sent.",
      data: {
        resendAvailableIn:
          OTP_RESEND_COOLDOWN_SECONDS,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: serializeAuthUser(req.user),
    },
  });
};

export const syncTimezone = async (req, res, next) => {
  try {
    const candidate = String(req.body.timezone || "").trim();

    if (!isValidTimeZone(candidate)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TIMEZONE",
        message: "A valid IANA timezone is required.",
      });
    }

    if (req.user.timezone !== candidate) {
      req.user.timezone = candidate;
      req.user.timezoneUpdatedAt = new Date();
      await req.user.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        user: serializeAuthUser(req.user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message: "Signed out successfully.",
  });
};