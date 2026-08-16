import "dotenv/config";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import learningProfileRoutes from "./routes/learningProfileRoutes.js";

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

app.use("/api/learning-profile", learningProfileRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;