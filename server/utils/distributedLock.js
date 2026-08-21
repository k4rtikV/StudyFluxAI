import { randomUUID } from "node:crypto";

import { getRedisClient } from "../config/redis.js";

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const acquireDistributedLock = async (key, ttlMs = 60000) => {
  const client = getRedisClient();
  if (!client) {
    return {
      acquired: true,
      distributed: false,
      release: async () => {},
    };
  }

  const token = randomUUID();
  const lockKey = `studyflux:lock:${key}`;

  try {
    const result = await client.set(lockKey, token, {
      NX: true,
      PX: Math.max(Number(ttlMs) || 60000, 1000),
    });

    if (result !== "OK") {
      return {
        acquired: false,
        distributed: true,
        release: async () => {},
      };
    }

    return {
      acquired: true,
      distributed: true,
      release: async () => {
        try {
          await client.eval(RELEASE_SCRIPT, {
            keys: [lockKey],
            arguments: [token],
          });
        } catch {
          // The lease TTL is the final safety net if Redis becomes unavailable.
        }
      },
    };
  } catch {
    // Redis availability must never make the core Mongo-backed path unusable.
    return {
      acquired: true,
      distributed: false,
      release: async () => {},
    };
  }
};

export const waitForCondition = async (
  operation,
  {
    timeoutMs = 15000,
    intervalMs = 250,
  } = {},
) => {
  const deadline = Date.now() + Math.max(Number(timeoutMs) || 0, 0);

  while (Date.now() <= deadline) {
    const value = await operation();
    if (value) return value;
    await wait(Math.max(Number(intervalMs) || 100, 50));
  }

  return null;
};
