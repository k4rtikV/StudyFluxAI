import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import PendingRegistration from "../models/PendingRegistration.js";
import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import { getNumberEnv } from "../config/env.js";

import {
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
  sendVerificationEmail,
} from "../services/email.service.js";
import { ensureSignupFluxGemBonus } from "../services/fluxGemReward.service.js";
import { verifyGoogleCredential } from "../services/googleAuth.service.js";
import {
  consumeVerificationCode,
  createVerificationCode,
  getLatestActiveVerificationCode,
  invalidateOtherVerificationCodes,
} from "../services/verificationCode.service.js";

import {
  isValidEmail,
  normalizeEmail,
  validateLoginInput,
  validateOtpInput,
  validatePasswordChangeInput,
  validatePasswordResetInput,
  validateRegistrationInput,
} from "../utils/authValidation.js";
import {
  clearAuthCookie,
  generateAuthToken,
  setAuthCookie,
} from "../utils/jwt.js";
import { OTP_RESEND_COOLDOWN_SECONDS } from "../utils/otp.js";
import { isValidTimeZone, normalizeTimeZone } from "../utils/timezone.js";

const DEFAULT_PENDING_REGISTRATION_MINUTES = 30;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("StudyFluxAI timing equalizer only", 12);

const pendingRegistrationMinutes = () =>
  getNumberEnv(
    "PENDING_REGISTRATION_TTL_MINUTES",
    DEFAULT_PENDING_REGISTRATION_MINUTES,
  );

const createClaimToken = () => crypto.randomBytes(32).toString("base64url");
const hashClaimToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

const claimTokenMatches = (token, storedHash) => {
  const provided = Buffer.from(hashClaimToken(token), "hex");
  const stored = Buffer.from(String(storedHash || ""), "hex");
  return provided.length === stored.length && provided.length > 0 && crypto.timingSafeEqual(provided, stored);
};

const applyReportedTimeZone = (user, reportedTimeZone) => {
  const candidate = String(reportedTimeZone || "").trim();
  if (!candidate || !isValidTimeZone(candidate) || isValidTimeZone(user.timezone)) return false;
  user.timezone = candidate;
  user.timezoneUpdatedAt = new Date();
  return true;
};

const applyWelcomeFluxGemBonus = async (user) => {
  if (!user?._id || user.role !== "student" || user.isEmailVerified !== true) return user;
  const reward = await ensureSignupFluxGemBonus(user._id);
  user.fluxGems = Number(reward?.balance ?? user.fluxGems ?? 0);
  return user;
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
  authProviders: Array.isArray(user.authProviders) ? user.authProviders : [],
  passwordUpdatedAt: user.passwordUpdatedAt || null,
  authMethodsUpdatedAt: user.authMethodsUpdatedAt || null,
});

const getReservedAdminEmail = () => normalizeEmail(process.env.ADMIN_SEED_EMAIL);
const isReservedAdminEmail = (email) => {
  const reservedEmail = getReservedAdminEmail();
  return Boolean(reservedEmail) && normalizeEmail(email) === reservedEmail;
};

const getAuthNextStep = (user) => {
  if (user?.role === "admin") return "admin_portal";
  return user?.learningProfileCompleted === true ? "dashboard" : "learning_profile";
};

const sendSession = (res, user, message) => {
  const token = generateAuthToken(user);
  setAuthCookie(res, token);
  return res.status(200).json({
    success: true,
    message,
    data: {
      user: serializeAuthUser(user),
      nextStep: getAuthNextStep(user),
    },
  });
};

const cleanupPendingRegistration = async (email) => {
  await Promise.all([
    PendingRegistration.deleteOne({ email }),
    VerificationCode.deleteMany({ email, purpose: "email_verification" }),
  ]);
};

const deleteLegacyUnverifiedLocalUser = async (email) => {
  const legacy = await User.findOne({ email, isEmailVerified: false, role: "student" });
  if (!legacy) return false;
  await User.deleteOne({ _id: legacy._id, isEmailVerified: false });
  await VerificationCode.deleteMany({ email, purpose: "email_verification" });
  return true;
};

const otpFailureResponse = (res, result) =>
  res.status(result.status || 400).json({
    success: false,
    code: result.code,
    message: result.message,
    ...(result.attemptsRemaining !== undefined
      ? { data: { attemptsRemaining: result.attemptsRemaining } }
      : {}),
  });

export const register = async (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    const validation = validateRegistrationInput({ fullName, email, password, confirmPassword });

    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors: validation.errors });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = String(fullName).trim();

    if (isReservedAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_RESERVED",
        message: "This email address is reserved for StudyFluxAI administration.",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser?.isEmailVerified) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists.",
      });
    }

    // Pre-Phase-2 builds created permanent unverified Users. They are intentionally
    // discarded so an old planted password can never become valid through a later claim.
    if (existingUser && !existingUser.isEmailVerified) {
      await deleteLegacyUnverifiedLocalUser(normalizedEmail);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const registrationToken = createClaimToken();
    const expiresAt = new Date(Date.now() + pendingRegistrationMinutes() * 60 * 1000);

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          fullName: normalizedName,
          passwordHash,
          claimTokenHash: hashClaimToken(registrationToken),
          expiresAt,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    await invalidateOtherVerificationCodes({
      email: normalizedEmail,
      purpose: "email_verification",
    });

    const { otp, verificationCode } = await createVerificationCode({
      email: normalizedEmail,
      purpose: "email_verification",
    });

    try {
      await sendVerificationEmail({ email: normalizedEmail, fullName: normalizedName, otp });
    } catch (emailError) {
      await VerificationCode.deleteOne({ _id: verificationCode._id });
      console.error("Verification email delivery failed:", emailError.message);
      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_FAILED",
        message: "We saved your pending registration, but couldn't send the verification email. Please retry sending the code.",
        data: { email: normalizedEmail, registrationToken },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Check your email for the verification code. Your account is created only after verification succeeds.",
      data: { email: normalizedEmail, registrationToken, verificationRequired: true },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const validation = validateLoginInput({ email, password });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors: validation.errors });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select("+password +authVersion");

    if (!user?.password) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, code: "ACCOUNT_DISABLED", message: "This account is currently unavailable." });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "REGISTRATION_RESTART_REQUIRED",
        message: "This legacy pending registration must be restarted before it can be verified.",
      });
    }

    applyReportedTimeZone(user, req.body.timezone);
    user.lastLoginAt = new Date();
    await user.save();
    await applyWelcomeFluxGemBonus(user);

    return sendSession(res, user, "Signed in successfully.");
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const credential = typeof req.body.credential === "string" ? req.body.credential.trim() : "";
    if (!credential) {
      return res.status(400).json({ success: false, code: "GOOGLE_CREDENTIAL_REQUIRED", message: "Google authentication information is required." });
    }

    let googleProfile;
    try {
      googleProfile = await verifyGoogleCredential(credential);
    } catch (error) {
      console.error("Google credential verification failed:", error.message);
      return res.status(401).json({ success: false, code: "INVALID_GOOGLE_CREDENTIAL", message: "Google sign-in could not be verified. Please try again." });
    }

    const { googleId, email, fullName, avatar, googleIsAuthoritativeForEmail } = googleProfile;

    if (isReservedAdminEmail(email)) {
      return res.status(403).json({ success: false, code: "ADMIN_PASSWORD_REQUIRED", message: "Admin accounts must sign in with their StudyFluxAI admin password." });
    }

    let user = await User.findOne({ googleId }).select("+googleId +authVersion");

    if (user) {
      if (user.role === "admin") {
        return res.status(403).json({ success: false, code: "ADMIN_PASSWORD_REQUIRED", message: "Admin accounts must sign in with their StudyFluxAI admin password." });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, code: "ACCOUNT_DISABLED", message: "This account is currently unavailable." });
      }
      if (normalizeEmail(user.email) !== normalizeEmail(email)) {
        return res.status(409).json({ success: false, code: "GOOGLE_EMAIL_CHANGED", message: "The email on this Google identity no longer matches the linked StudyFluxAI account. Contact support before continuing." });
      }

      if (!user.authProviders.includes("google")) user.authProviders.push("google");
      user.isEmailVerified = true;
      applyReportedTimeZone(user, req.body.timezone);
      user.lastLoginAt = new Date();
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    } else {
      user = await User.findOne({ email }).select("+googleId +password +authVersion");

      if (user) {
        if (user.role === "admin") {
          return res.status(403).json({ success: false, code: "ADMIN_PASSWORD_REQUIRED", message: "Admin accounts must sign in with their StudyFluxAI admin password." });
        }
        if (!user.isActive) {
          return res.status(403).json({ success: false, code: "ACCOUNT_DISABLED", message: "This account is currently unavailable." });
        }
        if (user.googleId && user.googleId !== googleId) {
          return res.status(409).json({ success: false, code: "GOOGLE_ACCOUNT_MISMATCH", message: "This StudyFluxAI account is already linked to another Google account." });
        }

        if (!user.isEmailVerified) {
          if (!googleIsAuthoritativeForEmail) {
            return res.status(409).json({
              success: false,
              code: "GOOGLE_EMAIL_CLAIM_REQUIRES_VERIFICATION",
              message: "For security, restart email registration or contact support before claiming this account with Google.",
            });
          }

          // Safely convert legacy pre-verification accounts to Google-only. Any planted
          // local credential is removed instead of being silently validated by Google.
          user.password = undefined;
          user.googleId = googleId;
          user.authProviders = ["google"];
          user.isEmailVerified = true;
          user.authVersion = Number(user.authVersion || 0) + 1;
          user.authMethodsUpdatedAt = new Date();
          applyReportedTimeZone(user, req.body.timezone);
          user.lastLoginAt = new Date();
          if (!user.avatar && avatar) user.avatar = avatar;
          await user.save();
          await cleanupPendingRegistration(email);
        } else if (!user.googleId) {
          return res.status(409).json({
            success: false,
            code: "GOOGLE_LINK_REQUIRES_REAUTH",
            message: "This email already has a verified StudyFluxAI account. Sign in with your password, then link Google from Settings & preferences.",
          });
        }
      } else {
        const pending = await PendingRegistration.findOne({ email, expiresAt: { $gt: new Date() } });
        if (pending && !googleIsAuthoritativeForEmail) {
          return res.status(409).json({
            success: false,
            code: "GOOGLE_EMAIL_CLAIM_REQUIRES_VERIFICATION",
            message: "A pending email registration exists. Complete that verification before using this Google identity.",
          });
        }

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
          authMethodsUpdatedAt: new Date(),
        });
        await cleanupPendingRegistration(email);
      }
    }

    await applyWelcomeFluxGemBonus(user);
    return sendSession(res, user, "Signed in with Google successfully.");
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, code: "GOOGLE_ACCOUNT_CONFLICT", message: "This Google account is already associated with another StudyFluxAI account." });
    }
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp ?? "").trim();
    const registrationToken = String(req.body.registrationToken || "").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address.", errors: { email: "Enter a valid email address." } });
    }
    const otpValidation = validateOtpInput(otp);
    if (!otpValidation.valid) {
      return res.status(400).json({ success: false, message: otpValidation.message, errors: { otp: otpValidation.message } });
    }
    if (!registrationToken) {
      return res.status(400).json({ success: false, code: "REGISTRATION_RESTART_REQUIRED", message: "This registration session is missing or expired. Start registration again." });
    }

    const alreadyVerified = await User.findOne({ email, isEmailVerified: true });
    if (alreadyVerified) {
      await cleanupPendingRegistration(email);
      return res.status(409).json({ success: false, code: "EMAIL_ALREADY_VERIFIED", message: "This email has already been verified. Please sign in." });
    }

    const pending = await PendingRegistration.findOne({ email }).select("+passwordHash +claimTokenHash");
    if (!pending || pending.expiresAt <= new Date() || !claimTokenMatches(registrationToken, pending.claimTokenHash)) {
      return res.status(400).json({ success: false, code: "REGISTRATION_RESTART_REQUIRED", message: "This registration session is invalid or expired. Start registration again." });
    }

    const result = await consumeVerificationCode({ email, purpose: "email_verification", otp });
    if (!result.ok) return otpFailureResponse(res, result);

    await deleteLegacyUnverifiedLocalUser(email);

    const now = new Date();
    const user = new User({
      fullName: pending.fullName,
      email,
      authProviders: ["local"],
      isEmailVerified: true,
      learningProfileCompleted: false,
      passwordUpdatedAt: now,
      authMethodsUpdatedAt: now,
      lastLoginAt: now,
    });
    user.setPasswordHash(pending.passwordHash);
    applyReportedTimeZone(user, req.body.timezone);

    try {
      await user.save();
    } catch (error) {
      if (error?.code === 11000) {
        await cleanupPendingRegistration(email);
        return res.status(409).json({ success: false, code: "ACCOUNT_ALREADY_CLAIMED", message: "This email was claimed by another verified sign-in flow. Please sign in instead." });
      }
      throw error;
    }

    await cleanupPendingRegistration(email);
    await applyWelcomeFluxGemBonus(user);
    return sendSession(res, user, "Email verified and account created successfully.");
  } catch (error) {
    next(error);
  }
};

export const resendVerificationCode = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const registrationToken = String(req.body.registrationToken || "").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const pending = await PendingRegistration.findOne({ email }).select("+claimTokenHash");
    if (!pending || pending.expiresAt <= new Date() || !registrationToken || !claimTokenMatches(registrationToken, pending.claimTokenHash)) {
      const verified = await User.exists({ email, isEmailVerified: true });
      return res.status(verified ? 409 : 400).json({
        success: false,
        code: verified ? "EMAIL_ALREADY_VERIFIED" : "REGISTRATION_RESTART_REQUIRED",
        message: verified ? "This email has already been verified." : "This registration session is invalid or expired. Start registration again.",
      });
    }

    const now = new Date();
    const latestCode = await getLatestActiveVerificationCode({ email, purpose: "email_verification" });
    if (latestCode && latestCode.resendAvailableAt > now) {
      const retryAfter = Math.ceil((latestCode.resendAvailableAt.getTime() - now.getTime()) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, code: "OTP_RESEND_COOLDOWN", message: `Please wait ${retryAfter} seconds before requesting another code.`, data: { retryAfter } });
    }

    const { otp, verificationCode } = await createVerificationCode({ email, purpose: "email_verification" });
    try {
      await sendVerificationEmail({ email, fullName: pending.fullName, otp });
    } catch (emailError) {
      await VerificationCode.deleteOne({ _id: verificationCode._id });
      console.error("Verification email resend failed:", emailError.message);
      return res.status(503).json({ success: false, code: "VERIFICATION_EMAIL_FAILED", message: "We couldn't send a new verification code. Please try again." });
    }

    await invalidateOtherVerificationCodes({ email, purpose: "email_verification", exceptId: verificationCode._id });
    return res.status(200).json({ success: true, message: "A new verification code has been sent.", data: { resendAvailableIn: OTP_RESEND_COOLDOWN_SECONDS } });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address.", errors: { email: "Enter a valid email address." } });
    }

    const genericResponse = {
      success: true,
      message: "If this email has an eligible StudyFluxAI password account, a reset code will arrive shortly.",
      data: { resendAvailableIn: OTP_RESEND_COOLDOWN_SECONDS },
    };

    const user = await User.findOne({ email }).select("+password");
    if (!user || user.role !== "student" || !user.isActive || !user.isEmailVerified || !user.password || !user.authProviders.includes("local")) {
      return res.status(200).json(genericResponse);
    }

    const now = new Date();
    const latestCode = await getLatestActiveVerificationCode({ email, purpose: "password_reset" });
    if (latestCode && latestCode.resendAvailableAt > now) {
      return res.status(200).json(genericResponse);
    }

    const { otp, verificationCode } = await createVerificationCode({ email, purpose: "password_reset" });
    try {
      await sendPasswordResetEmail({ email, fullName: user.fullName, otp });
      await invalidateOtherVerificationCodes({ email, purpose: "password_reset", exceptId: verificationCode._id });
    } catch (emailError) {
      await VerificationCode.deleteOne({ _id: verificationCode._id });
      console.error("Password reset email delivery failed:", emailError.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    const validation = validatePasswordResetInput({ email, otp, password, confirmPassword });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors: validation.errors });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select("+password +authVersion");
    if (!user || user.role !== "student" || !user.isActive || !user.isEmailVerified || !user.password || !user.authProviders.includes("local")) {
      return res.status(400).json({ success: false, code: "RESET_INVALID_OR_EXPIRED", message: "This reset request is invalid or expired. Request a new reset code." });
    }

    const result = await consumeVerificationCode({ email: normalizedEmail, purpose: "password_reset", otp: String(otp).trim() });
    if (!result.ok) return otpFailureResponse(res, result);

    if (await user.comparePassword(password)) {
      return res.status(400).json({ success: false, code: "PASSWORD_REUSE_NOT_ALLOWED", message: "Choose a password different from your current password. Request a new reset code before trying again.", errors: { password: "Choose a new password you are not currently using." } });
    }

    const now = new Date();
    user.password = password;
    user.authVersion = Number(user.authVersion || 0) + 1;
    user.passwordUpdatedAt = now;
    user.authMethodsUpdatedAt = now;
    await user.save();
    clearAuthCookie(res);

    sendSecurityAlertEmail({
      email: user.email,
      fullName: user.fullName,
      title: "Your password was reset",
      message: "Your StudyFluxAI password was changed using an emailed reset code. All previously issued sign-in sessions were revoked.",
    }).catch((error) => console.error("Password-reset security email failed:", error.message));

    return res.status(200).json({ success: true, message: "Password reset successfully. Sign in again with your new password." });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const validation = validatePasswordChangeInput({ currentPassword, newPassword, confirmPassword });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors: validation.errors });
    }

    const user = await User.findById(req.user._id).select("+password +authVersion");
    if (!user?.password || !user.authProviders.includes("local")) {
      return res.status(409).json({ success: false, code: "PASSWORD_LOGIN_UNAVAILABLE", message: "This account does not currently use password sign-in." });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, code: "CURRENT_PASSWORD_INCORRECT", message: "Current password is incorrect.", errors: { currentPassword: "Current password is incorrect." } });
    }
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, code: "PASSWORD_REUSE_NOT_ALLOWED", message: "Choose a different password.", errors: { newPassword: "Choose a password different from your current password." } });
    }

    const now = new Date();
    user.password = newPassword;
    user.authVersion = Number(user.authVersion || 0) + 1;
    user.passwordUpdatedAt = now;
    user.authMethodsUpdatedAt = now;
    await user.save();

    const token = generateAuthToken(user);
    setAuthCookie(res, token);

    sendSecurityAlertEmail({
      email: user.email,
      fullName: user.fullName,
      title: "Your password was changed",
      message: "Your StudyFluxAI password was changed from Settings & preferences. Other previously issued sign-in sessions were revoked.",
    }).catch((error) => console.error("Password-change security email failed:", error.message));

    return res.status(200).json({ success: true, message: "Password changed. Other sessions were revoked.", data: { user: serializeAuthUser(user) } });
  } catch (error) {
    next(error);
  }
};

export const linkGoogle = async (req, res, next) => {
  try {
    const credential = typeof req.body.credential === "string" ? req.body.credential.trim() : "";
    const currentPassword = String(req.body.currentPassword || "");
    if (!credential || !currentPassword) {
      return res.status(400).json({ success: false, code: "GOOGLE_LINK_REAUTH_REQUIRED", message: "Enter your current password and complete Google verification to link the account." });
    }

    const user = await User.findById(req.user._id).select("+password +googleId +authVersion");
    if (!user || user.role !== "student" || !user.isActive) {
      return res.status(403).json({ success: false, code: "ACCOUNT_UNAVAILABLE", message: "This account cannot link Google right now." });
    }
    if (!user.password || !user.authProviders.includes("local")) {
      return res.status(409).json({ success: false, code: "GOOGLE_LINK_REQUIRES_LOCAL_PASSWORD", message: "Google linking requires an existing password sign-in method for reauthentication." });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, code: "CURRENT_PASSWORD_INCORRECT", message: "Current password is incorrect." });
    }

    let googleProfile;
    try {
      googleProfile = await verifyGoogleCredential(credential);
    } catch {
      return res.status(401).json({ success: false, code: "INVALID_GOOGLE_CREDENTIAL", message: "Google verification failed. Please try again." });
    }

    if (normalizeEmail(googleProfile.email) !== normalizeEmail(user.email)) {
      return res.status(409).json({ success: false, code: "GOOGLE_EMAIL_MISMATCH", message: "Choose the Google account that uses the same verified email as this StudyFluxAI account." });
    }

    const otherOwner = await User.findOne({ googleId: googleProfile.googleId, _id: { $ne: user._id } });
    if (otherOwner) {
      return res.status(409).json({ success: false, code: "GOOGLE_ACCOUNT_CONFLICT", message: "That Google identity is already linked to another StudyFluxAI account." });
    }
    if (user.googleId && user.googleId !== googleProfile.googleId) {
      return res.status(409).json({ success: false, code: "GOOGLE_ACCOUNT_MISMATCH", message: "This StudyFluxAI account is already linked to a different Google identity." });
    }

    const changed = !user.googleId || !user.authProviders.includes("google");
    user.googleId = googleProfile.googleId;
    if (!user.authProviders.includes("google")) user.authProviders.push("google");
    if (!user.avatar && googleProfile.avatar) user.avatar = googleProfile.avatar;

    if (changed) {
      user.authVersion = Number(user.authVersion || 0) + 1;
      user.authMethodsUpdatedAt = new Date();
      await user.save();
    }

    const token = generateAuthToken(user);
    setAuthCookie(res, token);

    if (changed) {
      sendSecurityAlertEmail({
        email: user.email,
        fullName: user.fullName,
        title: "Google sign-in was linked",
        message: "Google sign-in was added to your StudyFluxAI account after password reauthentication. Other previously issued sessions were revoked.",
      }).catch((error) => console.error("Google-link security email failed:", error.message));
    }

    return res.status(200).json({ success: true, message: changed ? "Google sign-in linked securely." : "Google sign-in is already linked.", data: { user: serializeAuthUser(user) } });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    await applyWelcomeFluxGemBonus(req.user);
    return res.status(200).json({ success: true, data: { user: serializeAuthUser(req.user) } });
  } catch (error) {
    next(error);
  }
};

export const syncTimezone = async (req, res, next) => {
  try {
    const candidate = String(req.body.timezone || "").trim();
    if (!isValidTimeZone(candidate)) {
      return res.status(400).json({ success: false, code: "INVALID_TIMEZONE", message: "A valid IANA timezone is required." });
    }
    if (req.user.timezone !== candidate) {
      req.user.timezone = candidate;
      req.user.timezoneUpdatedAt = new Date();
      await req.user.save();
    }
    return res.status(200).json({ success: true, data: { user: serializeAuthUser(req.user) } });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: "Signed out successfully." });
};