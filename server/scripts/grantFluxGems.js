import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "../config/db.js";
import FluxGemTransaction from "../models/FluxGemTransaction.js";
import User from "../models/User.js";

const email = String(process.argv[2] || "")
  .trim()
  .toLowerCase();
const amount = Number(process.argv[3] || 0);

if (!email || !Number.isInteger(amount) || amount <= 0) {
  console.error(
    "Usage: npm run grant:gems -- user@example.com 200",
  );
  process.exit(1);
}

await connectDB();

try {
  const user = await User.findOneAndUpdate(
    {
      email,
      isActive: true,
    },
    {
      $inc: {
        fluxGems: amount,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!user) {
    console.error("No active StudyFluxAI user found for that email.");
    process.exitCode = 1;
  } else {
    await FluxGemTransaction.create({
      user: user._id,
      type: "grant",
      amount,
      balanceAfter: user.fluxGems,
      reason: "developer_grant",
      metadata: {
        source: "grantFluxGems script",
      },
    });

    console.log(
      `Granted ${amount} FluxGems to ${email}. New balance: ${user.fluxGems}`,
    );
  }
} finally {
  await mongoose.disconnect();
}
