import { createClient } from "redis";

import { getBooleanEnv, getNumberEnv } from "./env.js";

let redisClient = null;
let redisAvailable = false;
let reconnectTimer = null;
let connecting = false;
let shuttingDown = false;

const redisUrl = () => String(process.env.REDIS_URL || "").trim();
const reconnectMs = () => getNumberEnv("REDIS_RECONNECT_MS", 30000, { min: 5000, max: 300000 });

const ensureReconnectTimer = () => {
  if (shuttingDown || reconnectTimer || !redisUrl()) return;

  reconnectTimer = setInterval(() => {
    if (shuttingDown || connecting || redisClient?.isReady) return;
    connectRedis().catch(() => {});
  }, reconnectMs());
  reconnectTimer.unref?.();
};

const createRedisClient = () => {
  const client = createClient({
    url: redisUrl(),
    socket: {
      connectTimeout: getNumberEnv("REDIS_CONNECT_TIMEOUT_MS", 5000, { min: 1000, max: 30000 }),
      // We own reconnection explicitly so startup never hangs in an unbounded retry loop.
      reconnectStrategy: () => false,
    },
  });

  client.on("error", (error) => {
    redisAvailable = false;
    console.warn("Redis unavailable:", error.message);
    ensureReconnectTimer();
  });

  client.on("ready", () => {
    redisAvailable = true;
    console.log("Redis connected.");
  });

  client.on("end", () => {
    redisAvailable = false;
    ensureReconnectTimer();
  });

  return client;
};

export const connectRedis = async () => {
  if (!redisUrl()) {
    console.log("Redis disabled: REDIS_URL is not configured.");
    return null;
  }

  if (redisClient?.isReady) return redisClient;
  if (connecting) return null;

  shuttingDown = false;
  connecting = true;

  try {
    if (!redisClient || (!redisClient.isOpen && !redisClient.isReady)) {
      redisClient = createRedisClient();
    }

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    redisAvailable = Boolean(redisClient.isReady);
    ensureReconnectTimer();
    return redisAvailable ? redisClient : null;
  } catch (error) {
    redisAvailable = false;
    console.warn(
      "StudyFluxAI will continue with bounded process-local fallbacks while Redis reconnects:",
      error.message,
    );
    ensureReconnectTimer();
    return null;
  } finally {
    connecting = false;
  }
};

export const getRedisClient = () =>
  redisAvailable && redisClient?.isReady ? redisClient : null;

export const getRedisHealth = () => ({
  configured: Boolean(redisUrl()),
  required: getBooleanEnv("REDIS_REQUIRED", false),
  available: Boolean(redisAvailable && redisClient?.isReady),
});

export const getCachedJson = async (key) => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const setCachedJson = async (key, value, ttlSeconds = 60) => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Cache failures should never break the core MongoDB flow.
  }
};

export const deleteCacheKeys = async (...keys) => {
  const client = getRedisClient();
  if (!client || keys.length === 0) return;

  try {
    await client.del(keys);
  } catch {
    // Best-effort invalidation.
  }
};

export const closeRedis = async () => {
  shuttingDown = true;
  redisAvailable = false;

  if (reconnectTimer) clearInterval(reconnectTimer);
  reconnectTimer = null;

  if (!redisClient?.isOpen) return;

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
};
