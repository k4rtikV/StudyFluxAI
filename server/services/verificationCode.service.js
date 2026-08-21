import VerificationCode from "../models/VerificationCode.js";

import {
  generateOtp,
  hashOtp,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  verifyOtpHash,
} from "../utils/otp.js";

export const createVerificationCode = async ({
  email,
  purpose,
}) => {
  const otp = generateOtp();
  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000,
  );

  const resendAvailableAt = new Date(
    now.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
  );

  const verificationCode = await VerificationCode.create({
    email,
    purpose,
    codeHash: hashOtp(otp),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt,
    resendAvailableAt,
  });

  return {
    otp,
    verificationCode,
  };
};

export const invalidateOtherVerificationCodes = async ({
  email,
  purpose,
  exceptId,
}) => {
  const query = {
    email,
    purpose,
    usedAt: null,
  };

  if (exceptId) {
    query._id = {
      $ne: exceptId,
    };
  }

  await VerificationCode.updateMany(query, {
    $set: {
      usedAt: new Date(),
    },
  });
};

export const getLatestActiveVerificationCode = async ({ email, purpose }) =>
  VerificationCode.findOne({
    email,
    purpose,
    usedAt: null,
  }).sort({ createdAt: -1 });

export const consumeVerificationCode = async ({ email, purpose, otp }) => {
  const verificationCode = await VerificationCode.findOne({
    email,
    purpose,
    usedAt: null,
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");

  if (!verificationCode) {
    return {
      ok: false,
      code: "OTP_INVALID_OR_EXPIRED",
      status: 400,
      message: "This verification code is invalid or has expired. Request a new code.",
    };
  }

  const now = new Date();

  if (verificationCode.expiresAt <= now) {
    await VerificationCode.updateOne(
      { _id: verificationCode._id, usedAt: null },
      { $set: { usedAt: now } },
    );

    return {
      ok: false,
      code: "OTP_EXPIRED",
      status: 410,
      message: "This verification code has expired. Request a new code.",
    };
  }

  if (verificationCode.attempts >= verificationCode.maxAttempts) {
    return {
      ok: false,
      code: "OTP_ATTEMPTS_EXCEEDED",
      status: 429,
      message: "Too many incorrect attempts. Request a new verification code.",
      attemptsRemaining: 0,
    };
  }

  if (!verifyOtpHash(otp, verificationCode.codeHash)) {
    const updated = await VerificationCode.findOneAndUpdate(
      {
        _id: verificationCode._id,
        usedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: verificationCode.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );

    const attempts = Number(updated?.attempts ?? verificationCode.attempts + 1);
    const attemptsRemaining = Math.max(
      Number(verificationCode.maxAttempts) - attempts,
      0,
    );

    if (attemptsRemaining === 0) {
      await VerificationCode.updateOne(
        { _id: verificationCode._id, usedAt: null },
        { $set: { usedAt: now } },
      );
    }

    return {
      ok: false,
      code: attemptsRemaining === 0 ? "OTP_ATTEMPTS_EXCEEDED" : "OTP_INCORRECT",
      status: attemptsRemaining === 0 ? 429 : 400,
      message:
        attemptsRemaining === 0
          ? "Too many incorrect attempts. Request a new verification code."
          : "Incorrect verification code.",
      attemptsRemaining,
    };
  }

  const consumed = await VerificationCode.findOneAndUpdate(
    {
      _id: verificationCode._id,
      usedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: verificationCode.maxAttempts },
    },
    { $set: { usedAt: now } },
    { returnDocument: "after" },
  );

  if (!consumed) {
    return {
      ok: false,
      code: "OTP_ALREADY_USED",
      status: 409,
      message: "This verification code has already been used. Request a new code.",
    };
  }

  await invalidateOtherVerificationCodes({
    email,
    purpose,
    exceptId: verificationCode._id,
  });

  return {
    ok: true,
    verificationCode: consumed,
  };
};
