import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEmail,
  validatePassword,
  validatePasswordChangeInput,
  validatePasswordResetInput,
  validateRegistrationInput,
} from "../utils/authValidation.js";
import { generateAuthToken, verifyAuthToken } from "../utils/jwt.js";

process.env.JWT_SECRET ||= "test-only-studyfluxai-jwt-secret-that-is-long-enough";

test("registration validation rejects weak or mismatched passwords", () => {
  const weak = validateRegistrationInput({
    fullName: "Test Learner",
    email: "learner@example.com",
    password: "password",
    confirmPassword: "password",
  });
  assert.equal(weak.valid, false);
  assert.ok(weak.errors.password);

  const mismatch = validateRegistrationInput({
    fullName: "Test Learner",
    email: "learner@example.com",
    password: "StrongPass123",
    confirmPassword: "StrongPass124",
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.confirmPassword);
});

test("password reset validation requires OTP and a strong matching password", () => {
  const valid = validatePasswordResetInput({
    email: " Learner@Example.com ",
    otp: "123456",
    password: "NewStrongPass123",
    confirmPassword: "NewStrongPass123",
  });
  assert.equal(valid.valid, true);

  const invalid = validatePasswordResetInput({
    email: "learner@example.com",
    otp: "123",
    password: "short",
    confirmPassword: "different",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.otp);
  assert.ok(invalid.errors.password);
  assert.ok(invalid.errors.confirmPassword);
});

test("password change validation requires current password", () => {
  const result = validatePasswordChangeInput({
    currentPassword: "",
    newPassword: "AnotherStrong123",
    confirmPassword: "AnotherStrong123",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.currentPassword);
});

test("JWT carries auth version used for session revocation", () => {
  const token = generateAuthToken({
    _id: { toString: () => "507f1f77bcf86cd799439011" },
    role: "student",
    authVersion: 7,
  });
  const payload = verifyAuthToken(token);
  assert.equal(payload.av, 7);
  assert.equal(payload.role, "student");
});

test("email normalization remains deterministic", () => {
  assert.equal(normalizeEmail("  User@Example.COM  "), "user@example.com");
  assert.equal(validatePassword("StrongPass123"), null);
});
