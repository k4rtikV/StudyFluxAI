import VerificationCode from "../models/VerificationCode.js";

import {
  generateOtp,
  hashOtp,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
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