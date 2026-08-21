import { safeErrorDetails } from "../utils/safeError.js";

const errorHandler = (err, req, res, _next) => {
  const statusCode =
    err.statusCode ||
    err.status ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const serverError = statusCode >= 500;
  const production = process.env.NODE_ENV === "production";
  const requestId = req.id || res.getHeader("X-Request-Id") || "";

  if (serverError) {
    console.error(
      `[request-error] ${requestId || "no-request-id"} ${req.method} ${req.originalUrl || req.url}`,
      safeErrorDetails(err),
    );
  }

  const response = {
    success: false,
    code: serverError ? "INTERNAL_ERROR" : err.code,
    message:
      production && serverError
        ? "Something went wrong while processing your request."
        : err.message || "Something went wrong.",
    ...(requestId ? { requestId } : {}),
  };

  if (!response.code) delete response.code;

  if (!production && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
