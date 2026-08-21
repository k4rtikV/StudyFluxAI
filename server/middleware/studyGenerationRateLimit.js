import { getNumberEnv } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { consumeRedisFixedWindow } from "../utils/fixedWindowRateLimit.js";

const fallbackBuckets = new Map();

const pruneFallback = (now) => {
  if (fallbackBuckets.size < 500) return;
  for (const [key, bucket] of fallbackBuckets.entries()) {
    if (bucket.resetAt <= now) fallbackBuckets.delete(key);
  }
  while (fallbackBuckets.size > 1500) {
    const oldest = fallbackBuckets.keys().next().value;
    if (!oldest) break;
    fallbackBuckets.delete(oldest);
  }
};

const consumeFallback = ({ key, limit, windowMs, now }) => {
  pruneFallback(now);
  const existing = fallbackBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    fallbackBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
};


export const studyGenerationRateLimit = ({
  limit = getNumberEnv("STUDY_GENERATION_RATE_LIMIT_PER_HOUR", 20),
  windowMs = 60 * 60 * 1000,
} = {}) => async (req, res, next) => {
  const userId = String(req.user?._id || "anonymous");
  const key = `rate:study-generation:${userId}`;
  const now = Date.now();
  let result;

  try {
    const client = getRedisClient();
    result = client
      ? await consumeRedisFixedWindow({
          client,
          key,
          limit,
          windowSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
        })
      : consumeFallback({ key, limit, windowMs, now });
  } catch {
    result = consumeFallback({ key, limit, windowMs, now });
  }

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "STUDY_GENERATION_RATE_LIMITED",
      message: "Too many study-generation requests. Please wait before starting another generation.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};