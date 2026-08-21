const RATE_LIMIT_LUA = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])

if count == 1 or ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { count, ttl }
`;

export const consumeRedisFixedWindow = async ({ client, key, limit, windowSeconds }) => {
  const result = await client.eval(RATE_LIMIT_LUA, {
    keys: [key],
    arguments: [String(windowSeconds)],
  });
  const count = Number(result?.[0] || 0);
  const ttl = Math.max(1, Number(result?.[1]) || windowSeconds);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : ttl,
  };
};