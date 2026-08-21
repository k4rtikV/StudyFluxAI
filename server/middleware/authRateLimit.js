import crypto from "node:crypto";

import { getRedisClient } from "../config/redis.js";

const fallbackBuckets = new Map();

const normalizePart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 256);

const hashKey = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);

const pruneFallback = (now) => {
  if (fallbackBuckets.size < 1000) return;
  for (const [key, bucket] of fallbackBuckets.entries()) {
    if (bucket.resetAt <= now) fallbackBuckets.delete(key);
  }

  while (fallbackBuckets.size > 2500) {
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

const consumeRedis = async ({ client, key, limit, windowSeconds }) => {
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, windowSeconds);
  const ttl = Math.max(1, Number(await client.ttl(key)) || windowSeconds);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : ttl,
  };
};

export const authRateLimit = ({
  bucket,
  limit,
  windowMs = 15 * 60 * 1000,
  includeEmail = false,
}) => async (req, res, next) => {
  const ip = normalizePart(req.ip || req.socket?.remoteAddress || "unknown");
  const email = includeEmail ? normalizePart(req.body?.email) : "";
  const keyMaterial = `${bucket}:${ip}:${email}`;
  const key = `rate:auth:${bucket}:${hashKey(keyMaterial)}`;
  const now = Date.now();
  let result;

  try {
    const client = getRedisClient();
    result = client
      ? await consumeRedis({
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
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts. Please wait and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return next();
};
