import "dotenv/config";

import { createServer } from "node:http";

import app from "./app.js";
import connectDB from "./config/db.js";
import { closeRedis, connectRedis } from "./config/redis.js";
import { initializeSocketServer } from "./realtime/socket.js";
import { startInterviewJobWorker, stopInterviewJobWorker } from "./services/interviewJob.service.js";
import {
  recoverStaleStudyGenerations,
  startStudyGenerationRecoverySweep,
} from "./services/studyGenerationQueue.service.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await connectRedis();

  const server = createServer(app);
  initializeSocketServer(server);

  recoverStaleStudyGenerations().catch((error) => {
    console.error("Initial study generation recovery failed:", error);
  });
  startStudyGenerationRecoverySweep();
  startInterviewJobWorker().catch((error) => {
    console.error("Initial Smart Interview job recovery failed:", error);
  });

  server.listen(PORT, () => {
    console.log(`StudyFluxAI server running on port ${PORT}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      stopInterviewJobWorker();
      await closeRedis();
      console.log("StudyFluxAI server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start StudyFluxAI:", error);
  process.exit(1);
});
