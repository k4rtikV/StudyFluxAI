import { randomUUID } from "node:crypto";

export const requestTiming = (req, res, next) => {
  const started = process.hrtime.bigint();
  const incomingRequestId = String(req.get("x-request-id") || "").trim();
  const requestId = /^[a-zA-Z0-9._:-]{8,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
  const originalEnd = res.end;

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.end = function timedEnd(...args) {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (!res.headersSent) {
      res.setHeader("Server-Timing", `app;dur=${elapsedMs.toFixed(1)}`);
    }
    return originalEnd.apply(this, args);
  };

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const slowThreshold = Number(process.env.SLOW_REQUEST_LOG_MS || 1500);

    if (
      Number.isFinite(slowThreshold) &&
      slowThreshold > 0 &&
      elapsedMs >= slowThreshold &&
      !req.path?.includes("/health")
    ) {
      console.warn(
        `[slow-request] ${requestId} ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${elapsedMs.toFixed(0)}ms`,
      );
    }
  });

  next();
};
