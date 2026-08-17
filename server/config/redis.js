import { createClient } from "redis";

let redisClient = null;
let redisAvailable = false;

export const connectRedis = async () => {
  const redisUrl = String(process.env.REDIS_URL || "").trim();

  if (!redisUrl) {
    console.log("Redis disabled: REDIS_URL is not configured.");
    return null;
  }

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: () => false,
    },
  });

  redisClient.on("error", (error) => {
    redisAvailable = false;
    console.warn("Redis unavailable:", error.message);
  });

  redisClient.on("ready", () => {
    redisAvailable = true;
    console.log("Redis connected.");
  });

  try {
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch (error) {
    redisAvailable = false;
    console.warn(
      "StudyFluxAI will continue with MongoDB-only community reads:",
      error.message,
    );
    return null;
  }
};

export const getRedisClient = () =>
  redisAvailable && redisClient?.isReady ? redisClient : null;

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
  if (!redisClient?.isOpen) return;

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }

  redisAvailable = false;
};
