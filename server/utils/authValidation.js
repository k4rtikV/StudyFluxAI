const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

export const normalizeEmail = (email) => {
  return String(email ?? "").trim().toLowerCase();
};

export const isValidEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);

  return (
    normalizedEmail.length > 0 &&
    normalizedEmail.length <= 254 &&
    EMAIL_REGEX.test(normalizedEmail)
  );
};

export const isValidOtp = (otp) => {
  return OTP_REGEX.test(String(otp ?? "").trim());
};

export const validatePassword = (password) => {
  if (typeof password !== "string") {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (password.length > 72) {
    return "Password cannot exceed 72 characters.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }

  return null;
};

export const validateRegistrationInput = ({
  fullName,
  email,
  password,
  confirmPassword,
}) => {
  const errors = {};

  const normalizedName = String(fullName ?? "").trim();

  if (normalizedName.length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  } else if (normalizedName.length > 60) {
    errors.fullName = "Full name cannot exceed 60 characters.";
  }

  if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    errors.password = passwordError;
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateLoginInput = ({ email, password }) => {
  const errors = {};

  if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.password = "Password is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateOtpInput = (otp) => {
  if (!isValidOtp(otp)) {
    return {
      valid: false,
      message: "Enter the 6-digit verification code.",
    };
  }

  return {
    valid: true,
  };
};