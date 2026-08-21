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

  const studyExportModel = mongoose.models.StudyExport;
  if (studyExportModel) {
    try {
      await studyExportModel.collection.updateMany(
        { exportMode: { $exists: false } },
        { $set: { exportMode: "standard" } },
      );
      await studyExportModel.collection.updateMany(
        { status: { $exists: false }, externalId: { $nin: [null, ""] } },
        { $set: { status: "created" } },
      );

      const indexes = await studyExportModel.collection.listIndexes().toArray();
      for (const index of indexes) {
        const key = index?.key || {};
        const isLegacyStudyExportUnique =
          index.unique === true &&
          key.studySession === 1 &&
          key.exportType === 1 &&
          Object.keys(key).length === 2;

        if (isLegacyStudyExportUnique) {
          await studyExportModel.collection.dropIndex(index.name);
          console.log(`[indexes] dropped legacy StudyExport index ${index.name}`);
        }
      }
    } catch (error) {
      if (error?.codeName !== "NamespaceNotFound" && error?.code !== 26) throw error;
    }
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