import express from "express";
import mongoose from "mongoose";

import { getRedisHealth } from "../config/redis.js";

const router = express.Router();

const databaseState = () => (mongoose.connection.readyState === 1 ? "up" : "down");

router.get("/live", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "live",
  });
});

router.get("/ready", async (_req, res) => {
  const redis = getRedisHealth();
  let database = databaseState();

  if (database === "up") {
    try {
      await mongoose.connection.db.command({ ping: 1 }, { maxTimeMS: 1500 });
    } catch {
      database = "down";
    }
  }

  const redisReady = !redis.required || redis.available;
  const ready = database === "up" && redisReady;

  return res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "unavailable",
    checks: {
      database,
      redis: redis.configured ? (redis.available ? "up" : "down") : "not_configured",
      redisRequired: redis.required,
    },
  });
});

router.get("/", (_req, res) => {
  const redis = getRedisHealth();
  const database = databaseState();
  const ready = database === "up" && (!redis.required || redis.available);

  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "unavailable",
  });
});

export default router;
