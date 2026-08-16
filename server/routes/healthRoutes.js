import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    message: "StudyFluxAI API is running",
    database: databaseConnected ? "connected" : "disconnected",
    environment: process.env.NODE_ENV,
  });
});

export default router;