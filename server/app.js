import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import {
  getBooleanEnv,
  getTrustProxySetting,
  isAllowedClientOrigin,
  isProduction,
} from "./config/env.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import { requestTiming } from "./middleware/requestTiming.js";
import {
  browserRequestGuard,
  noStoreApiResponses,
} from "./middleware/browserSecurity.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import fluxGemRoutes from "./routes/fluxGemRoutes.js";
import fluxGemPurchaseRoutes from "./routes/fluxGemPurchaseRoutes.js";
import learningProfileRoutes from "./routes/learningProfileRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import studySessionRoutes from "./routes/studySessionRoutes.js";
import studyPlannerRoutes from "./routes/studyPlannerRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import studyExportRoutes from "./routes/studyExportRoutes.js";
import googleFormsIntegrationRoutes from "./routes/googleFormsIntegrationRoutes.js";
import tutorRoutes from "./routes/tutorRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import { handleRazorpayWebhook } from "./controllers/fluxGemPurchase.controller.js";

const app = express();
const production = isProduction();

app.disable("x-powered-by");
app.set("trust proxy", getTrustProxySetting());

app.use(requestTiming);
app.use(
  helmet({
    hsts: production
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://checkout.razorpay.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.googleusercontent.com",
          "https://*.gstatic.com",
          "https://*.razorpay.com",
        ],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://*.googleapis.com",
          "https://*.razorpay.com",
          ...(!production ? ["ws:", "wss:"] : []),
        ],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://*.razorpay.com",
        ],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser/server-to-server requests often have no Origin header.
      if (!origin) return callback(null, true);
      return callback(null, isAllowedClientOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
    exposedHeaders: [
      "Content-Disposition",
      "Server-Timing",
      "X-Request-Id",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "Retry-After",
      "X-Interview-TTS-Ms",
      "X-Interview-Audio-Cache",
      "X-Interview-Voice",
    ],
    maxAge: 600,
  }),
);

app.use(cookieParser());

// Razorpay requires the exact raw request body for webhook signature verification.
// This endpoint intentionally bypasses browser-origin checks because Razorpay calls it server-to-server.
app.post(
  "/api/fluxgems/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleRazorpayWebhook,
);

app.use("/api", noStoreApiResponses);
app.use("/api", browserRequestGuard);
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "1mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_BODY_LIMIT || "1mb",
    parameterLimit: 500,
  }),
);

app.get("/", (req, res, next) => {
  if (production && getBooleanEnv("SERVE_CLIENT_BUILD", true)) return next();
  return res.status(200).json({
    success: true,
    message: "Welcome to the StudyFluxAI API",
  });
});

app.use("/api/health", healthRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/fluxgems", fluxGemRoutes);
app.use("/api/fluxgems/purchases", fluxGemPurchaseRoutes);
app.use("/api/learning-profile", learningProfileRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/study-sessions", studySessionRoutes);
app.use("/api/study-planner", studyPlannerRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/study-exports", studyExportRoutes);
app.use("/api/integrations/google-forms", googleFormsIntegrationRoutes);

const appDir = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(appDir, "../client/dist");
const clientIndex = path.join(clientDistDir, "index.html");
const shouldServeClient = getBooleanEnv("SERVE_CLIENT_BUILD", production);

if (shouldServeClient && fs.existsSync(clientIndex)) {
  app.use(
    express.static(clientDistDir, {
      index: false,
      etag: true,
      maxAge: 0,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    if (!req.accepts("html")) return next();

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(clientIndex);
  });
} else if (production && shouldServeClient) {
  console.warn(
    `[config-warning] SERVE_CLIENT_BUILD is enabled but ${clientIndex} does not exist. Run the client production build before starting the server.`,
  );
}

app.use(notFound);
app.use(errorHandler);

export default app;