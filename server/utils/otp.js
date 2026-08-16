import crypto from "crypto";

const OTP_LENGTH = 6;

const getOtpSecret = () => {
  if (!process.env.OTP_SECRET) {
    throw new Error("OTP_SECRET is missing from environment variables.");
  }

  return process.env.OTP_SECRET;
};

export const generateOtp = () => {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;

  return crypto.randomInt(min, max).toString();
};

export const hashOtp = (otp) => {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(String(otp))
    .digest("hex");
};

export const verifyOtpHash = (otp, storedHash) => {
  const providedHash = hashOtp(otp);

  const providedBuffer = Buffer.from(providedHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
};

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;