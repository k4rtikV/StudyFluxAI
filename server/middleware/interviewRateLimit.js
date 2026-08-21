import { getRedisClient } from "../config/redis.js";
import { consumeRedisFixedWindow } from "../utils/fixedWindowRateLimit.js";

const fallbackBuckets = new Map();

const pruneFallback = (now) => {
  if (fallbackBuckets.size < 500) return;
  for (const [key, bucket] of fallbackBuckets.entries()) {
    if (bucket.resetAt <= now) fallbackBuckets.delete(key);
  }

  while (fallbackBuckets.size > 1500) {
    const oldestKey = fallbackBuckets.keys().next().value;
    if (!oldestKey) break;
    fallbackBuckets.delete(oldestKey);
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


export const interviewRateLimit = ({ bucket, limit, windowMs = 60000 }) => async (req, res, next) => {
  const userId = String(req.user?._id || "anonymous");
  const key = `rate:smart-interview:${bucket}:${userId}`;
  const now = Date.now();
  let result;

  try {
    const client = getRedisClient();
    result = client
      ? await consumeRedisFixedWindow({ client, key, limit, windowSeconds: Math.max(1, Math.ceil(windowMs / 1000)) })
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
      code: "INTERVIEW_RATE_LIMITED",
      message: "Smart Interview is receiving requests too quickly. Please wait a moment and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};