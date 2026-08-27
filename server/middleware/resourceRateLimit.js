import { getRedisClient } from "../config/redis.js";
import { consumeRedisFixedWindow } from "../utils/fixedWindowRateLimit.js";

const fallbackBuckets = new Map();
const FALLBACK_PRUNE_AT = 1000;
const FALLBACK_MAX_BUCKETS = 2500;

const pruneFallback = (now) => {
  if (fallbackBuckets.size < FALLBACK_PRUNE_AT) return;

  for (const [key, bucket] of fallbackBuckets.entries()) {
    if (bucket.resetAt <= now) fallbackBuckets.delete(key);
  }

  while (fallbackBuckets.size > FALLBACK_MAX_BUCKETS) {
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
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
};

export const resourceRateLimit = ({
  bucket,
  limit,
  windowMs = 15 * 60 * 1000,
  message = "This operation is being requested too frequently. Please wait and try again.",
}) => async (req, res, next) => {
  const userId = String(req.user?._id || "anonymous");
  const safeBucket = String(bucket || "resource").replace(/[^a-z0-9:_-]/gi, "-").slice(0, 80);
  const key = `rate:resource:${safeBucket}:${userId}`;
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
      code: "RESOURCE_RATE_LIMITED",
      message,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};
