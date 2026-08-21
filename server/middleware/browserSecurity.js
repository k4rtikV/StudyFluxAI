import { isAllowedClientOrigin } from "../config/env.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const browserRequestGuard = (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const fetchSite = String(req.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return res.status(403).json({
      success: false,
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "This request was blocked by StudyFluxAI request security.",
    });
  }

  const origin = String(req.get("origin") || "").trim();
  if (origin && !isAllowedClientOrigin(origin)) {
    return res.status(403).json({
      success: false,
      code: "ORIGIN_NOT_ALLOWED",
      message: "This request origin is not allowed.",
    });
  }

  return next();
};

export const noStoreApiResponses = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
};
