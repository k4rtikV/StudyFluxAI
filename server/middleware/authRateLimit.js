import { getRedisClient } from "../config/redis.js";
import { buildAuthRateLimitKeys } from "../utils/authRateLimitIdentity.js";

const fallbackBuckets = new Map();

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
  accountLimit = null,
}) => async (req, res, next) => {
  const { primaryKey, accountKey } = buildAuthRateLimitKeys({
    bucket,
    ip: req.ip || req.socket?.remoteAddress || "unknown",
    email: req.body?.email,
    includeEmail,
    accountLimit,
  });
  const now = Date.now();
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const consume = async (key, scopedLimit) => {
    try {
      const client = getRedisClient();
      return client
        ? await consumeRedis({ client, key, limit: scopedLimit, windowSeconds })
        : consumeFallback({ key, limit: scopedLimit, windowMs, now });
    } catch {
      return consumeFallback({ key, limit: scopedLimit, windowMs, now });
    }
  };

  const results = [{ ...(await consume(primaryKey, limit)), limit }];

  if (accountKey) {
    results.push({ ...(await consume(accountKey, accountLimit)), limit: accountLimit });
  }

  const tightest = [...results].sort(
    (left, right) => left.remaining / left.limit - right.remaining / right.limit,
  )[0];
  const blocked = results.filter((result) => !result.allowed);

  res.setHeader("X-RateLimit-Limit", String(tightest.limit));
  res.setHeader("X-RateLimit-Remaining", String(tightest.remaining));

  if (blocked.length > 0) {
    const retryAfterSeconds = Math.max(
      ...blocked.map((result) => result.retryAfterSeconds),
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts. Please wait and try again.",
      retryAfterSeconds,
    });
  }

  return next();
};