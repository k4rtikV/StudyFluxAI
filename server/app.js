import "dotenv/config";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import fluxGemRoutes from "./routes/fluxGemRoutes.js";
import fluxGemPurchaseRoutes from "./routes/fluxGemPurchaseRoutes.js";
import learningProfileRoutes from "./routes/learningProfileRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import studySessionRoutes from "./routes/studySessionRoutes.js";
import studyExportRoutes from "./routes/studyExportRoutes.js";
import googleFormsIntegrationRoutes from "./routes/googleFormsIntegrationRoutes.js";
import tutorRoutes from "./routes/tutorRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { handleRazorpayWebhook } from "./controllers/fluxGemPurchase.controller.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(cookieParser());

// Razorpay requires the exact raw request body for webhook signature verification.
app.post(
  "/api/fluxgems/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleRazorpayWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the StudyFluxAI API",
  });
});

app.use("/api/health", healthRoutes);

/*
 * API routes will be registered above these two middleware functions.
 */

app.use("/api/auth", authRoutes);

app.use("/api/fluxgems", fluxGemRoutes);
app.use("/api/fluxgems/purchases", fluxGemPurchaseRoutes);

app.use("/api/learning-profile", learningProfileRoutes);

app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.use("/api/tutor", tutorRoutes);

app.use("/api/community", communityRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/study-sessions", studySessionRoutes);

app.use("/api/study-exports", studyExportRoutes);

app.use(
  "/api/integrations/google-forms",
  googleFormsIntegrationRoutes,
);

app.use(notFound);
app.use(errorHandler);

export default app;