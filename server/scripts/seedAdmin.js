import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import VerificationCode from "../models/VerificationCode.js";

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const email = normalizeEmail(process.env.ADMIN_SEED_EMAIL);
const password = String(process.env.ADMIN_SEED_PASSWORD || "");
const fullName =
  String(process.env.ADMIN_SEED_NAME || "StudyFluxAI Admin").trim() ||
  "StudyFluxAI Admin";

if (!email || !email.includes("@")) {
  console.error(
    "ADMIN_SEED_EMAIL is missing or invalid in server/.env.",
  );
  process.exit(1);
}

if (password.length < 12) {
  console.error(
    "ADMIN_SEED_PASSWORD must be at least 12 characters long.",
  );
  process.exit(1);
}

await connectDB();

try {
  let admin = await User.findOne({ email }).select(
    "+password +googleId +authVersion",
  );

  const created = !admin;

  if (!admin) {
    admin = new User({
      fullName,
      email,
      authProviders: ["local"],
      role: "admin",
      isEmailVerified: true,
      learningProfileCompleted: false,
      isActive: true,
    });
  }

  admin.fullName = fullName;
  admin.email = email;
  admin.password = password;
  admin.googleId = undefined;
  admin.authProviders = ["local"];
  admin.role = "admin";
  admin.isEmailVerified = true;
  admin.learningProfileCompleted = false;
  admin.isActive = true;
  admin.authVersion = Number(admin.authVersion || 0) + 1;
  admin.passwordUpdatedAt = new Date();
  admin.authMethodsUpdatedAt = new Date();

  await admin.save();

  // A seeded admin never needs public email-verification OTP state.
  await Promise.all([
    VerificationCode.deleteMany({ email }),
    PendingRegistration.deleteMany({ email }),
  ]);

  console.log(
    `${created ? "Created" : "Updated"} StudyFluxAI admin: ${admin.email}`,
  );
  console.log(
    "The admin can now sign in through the normal /login page and will be routed to /admin.",
  );
} finally {
  await mongoose.disconnect();
}
