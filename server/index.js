import "dotenv/config";

import { createServer } from "node:http";

import { safeErrorDetails } from "./utils/safeError.js";

import app from "./app.js";
import connectDB, { closeDB } from "./config/db.js";
import { assertRuntimeEnvironment, getBooleanEnv, getNumberEnv } from "./config/env.js";
import { closeRedis, connectRedis } from "./config/redis.js";
import {
  closeSocketServer,
  initializeSocketServer,
} from "./realtime/socket.js";
import {
  getInterviewJobWorkerStatus,
  startInterviewJobWorker,
  stopInterviewJobWorker,
} from "./services/interviewJob.service.js";
import {
  getStudyPlanReminderWorkerStatus,
  startStudyPlanReminderWorker,
  stopStudyPlanReminderWorker,
} from "./services/studyPlanReminder.service.js";
import {
  getStudyGenerationWorkerStatus,
  recoverStaleStudyGenerations,
  startStudyGenerationRecoverySweep,
  stopStudyGenerationRecoverySweep,
} from "./services/studyGenerationQueue.service.js";

const PORT = Number(process.env.PORT || 5000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForBackgroundWork = async (timeoutMs) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const study = getStudyGenerationWorkerStatus();
    const interview = getInterviewJobWorkerStatus();
    const reminders = getStudyPlanReminderWorkerStatus();

    if (study.idle && interview.idle && reminders.idle) {
      return true;
    }

    await sleep(250);
  }

  return false;
};

const closeHttpServer = (server, timeoutMs) =>
  new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve();
    };

    server.close(finish);

    timer = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      finish();
    }, timeoutMs);
    timer.unref?.();
  });

const startServer = async () => {
  assertRuntimeEnvironment();
  await connectDB();
  const redis = await connectRedis();
  if (getBooleanEnv("REDIS_REQUIRED", false) && !redis) {
    throw new Error("Redis is required but could not be reached during startup.");
  }

  const server = createServer(app);
  initializeSocketServer(server);

  server.requestTimeout = getNumberEnv("HTTP_REQUEST_TIMEOUT_MS", 180000, {
    min: 30000,
    max: 600000,
  });
  server.keepAliveTimeout = getNumberEnv("HTTP_KEEP_ALIVE_TIMEOUT_MS", 65000, {
    min: 5000,
    max: 120000,
  });
  server.headersTimeout = Math.max(
    server.keepAliveTimeout + 5000,
    getNumberEnv("HTTP_HEADERS_TIMEOUT_MS", 70000, {
      min: 10000,
      max: 180000,
    }),
  );

  recoverStaleStudyGenerations().catch((error) => {
    console.error("Initial study generation recovery failed:", safeErrorDetails(error));
  });
  startStudyGenerationRecoverySweep();
  startInterviewJobWorker().catch((error) => {
    console.error("Initial Smart Interview job recovery failed:", safeErrorDetails(error));
  });
  startStudyPlanReminderWorker().catch((error) => {
    console.error("Initial Study Planner reminder worker startup failed:", safeErrorDetails(error));
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`StudyFluxAI server running on port ${PORT}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    stopStudyGenerationRecoverySweep();
    stopInterviewJobWorker();
    stopStudyPlanReminderWorker();

    const graceMs = getNumberEnv("SHUTDOWN_GRACE_MS", 45000, {
      min: 5000,
      max: 120000,
    });

    try {
      await closeSocketServer();
      await closeHttpServer(server, Math.min(graceMs, 15000));

      const drained = await waitForBackgroundWork(graceMs);
      if (!drained) {
        const study = getStudyGenerationWorkerStatus();
        const interview = getInterviewJobWorkerStatus();
        const reminders = getStudyPlanReminderWorkerStatus();
        console.warn("Shutdown grace period expired with background work still active:", {
          study,
          interview,
          reminders,
        });
      }
    } catch (error) {
      console.error("Graceful shutdown encountered an error:", safeErrorDetails(error));
      exitCode = 1;
    } finally {
      await Promise.allSettled([closeRedis(), closeDB()]);
      console.log("StudyFluxAI server stopped.");
      process.exit(exitCode);
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("uncaughtException", (error) => {
    console.error("Uncaught exception:", safeErrorDetails(error));
    shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", safeErrorDetails(reason));
    shutdown("unhandledRejection", 1);
  });
};

startServer().catch((error) => {
  console.error("Failed to start StudyFluxAI:", safeErrorDetails(error));
  process.exit(1);
});
