import { getRedisClient } from "../config/redis.js";
import { consumeRedisFixedWindow } from "../utils/fixedWindowRateLimit.js";

const fallbackBuckets = new Map();
const LIMIT = 12;
const WINDOW_MS = 60 * 60 * 1000;

const consumeFallback = ({ key, now }) => {
  if (fallbackBuckets.size > 1000) {
    for (const [bucketKey, bucket] of fallbackBuckets.entries()) {
      if (bucket.resetAt <= now) fallbackBuckets.delete(bucketKey);
    }

    while (fallbackBuckets.size > 2500) {
      const oldestKey = fallbackBuckets.keys().next().value;
      if (!oldestKey) break;
      fallbackBuckets.delete(oldestKey);
    }
  }

  const existing = fallbackBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    fallbackBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= LIMIT,
    remaining: Math.max(0, LIMIT - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
};

export const supportRateLimit = async (req, res, next) => {
  const key = `rate:support:${String(req.user?._id || "anonymous")}`;
  const now = Date.now();
  let result;

  try {
    const client = getRedisClient();
    result = client
      ? await consumeRedisFixedWindow({ client, key, limit: LIMIT, windowSeconds: WINDOW_MS / 1000 })
      : consumeFallback({ key, now });
  } catch {
    result = consumeFallback({ key, now });
  }

  res.setHeader("X-RateLimit-Limit", String(LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "SUPPORT_RATE_LIMITED",
      message: "You have sent several support requests recently. Please wait before sending another.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};