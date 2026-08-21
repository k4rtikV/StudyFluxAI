import mongoose from "mongoose";

import { getBooleanEnv, getNumberEnv, isProduction } from "./env.js";

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from environment variables.");
  }

  const connection = await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: getBooleanEnv("MONGO_AUTO_INDEX", !isProduction()),
    serverSelectionTimeoutMS: getNumberEnv(
      "MONGO_SERVER_SELECTION_TIMEOUT_MS",
      10000,
      { min: 3000, max: 30000 },
    ),
  });

  console.log(
    `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`,
  );

  return connection;
};

export const closeDB = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
};

export default connectDB;
