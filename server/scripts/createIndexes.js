import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

import connectDB, { closeDB } from "../config/db.js";
import { assertRuntimeEnvironment } from "../config/env.js";
import { safeErrorDetails } from "../utils/safeError.js";

const run = async () => {
  assertRuntimeEnvironment();
  await connectDB();

  const modelsDir = path.resolve(process.cwd(), "models");
  const modelFiles = (await fs.readdir(modelsDir))
    .filter((name) => name.endsWith(".js"))
    .sort();

  for (const file of modelFiles) {
    await import(pathToFileURL(path.join(modelsDir, file)).href);
  }

  const names = mongoose.modelNames().sort();
  for (const name of names) {
    const model = mongoose.model(name);
    await model.createIndexes();
    console.log(`[indexes] ${name}`);
  }

  console.log(`StudyFluxAI indexes ensured for ${names.length} model(s).`);
};

run()
  .catch((error) => {
    console.error("StudyFluxAI index creation failed:", safeErrorDetails(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
