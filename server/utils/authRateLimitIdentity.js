import crypto from "node:crypto";

const normalizePart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 256);

const hashKey = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);

export const buildAuthRateLimitKeys = ({
  bucket,
  ip,
  email,
  includeEmail = false,
  accountLimit = null,
}) => {
  const normalizedBucket = normalizePart(bucket) || "auth";
  const normalizedIp = normalizePart(ip) || "unknown";
  const normalizedEmail = normalizePart(email);
  const primaryMaterial = includeEmail
    ? `${normalizedBucket}:${normalizedIp}:${normalizedEmail}`
    : `${normalizedBucket}:ip:${normalizedIp}`;

  return {
    primaryKey: `rate:auth:${normalizedBucket}:${hashKey(primaryMaterial)}`,
    accountKey:
      Number.isFinite(accountLimit) && accountLimit > 0 && normalizedEmail
        ? `rate:auth:${normalizedBucket}:account:${hashKey(normalizedEmail)}`
        : "",
  };
};