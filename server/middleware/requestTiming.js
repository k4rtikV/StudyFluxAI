export const requestTiming = (req, res, next) => {
  const started = process.hrtime.bigint();
  const originalEnd = res.end;

  res.end = function patchedEnd(...args) {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    if (!res.headersSent) {
      res.setHeader("Server-Timing", `app;dur=${elapsedMs.toFixed(1)}`);
    }

    const slowThreshold = Number(process.env.SLOW_REQUEST_LOG_MS || 1500);
    if (
      Number.isFinite(slowThreshold) &&
      slowThreshold > 0 &&
      elapsedMs >= slowThreshold &&
      !req.path?.includes("/health")
    ) {
      console.warn(
        `[slow-request] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${elapsedMs.toFixed(0)}ms`,
      );
    }

    return originalEnd.apply(this, args);
  };

  next();
};
