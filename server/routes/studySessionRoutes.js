import express from "express";

import {
  generateStudySession,
  getStudySession,
  listStudySessions,
  submitStudyQuiz,
} from "../controllers/studySession.controller.js";
import { protect } from "../middleware/auth.js";
import { uploadStudySource } from "../middleware/studySourceUpload.js";
import { studyGenerationRateLimit } from "../middleware/studyGenerationRateLimit.js";

const router = express.Router();

router.get("/", protect, listStudySessions);

router.post(
  "/generate",
  protect,
  studyGenerationRateLimit(),
  uploadStudySource,
  generateStudySession,
);

router.get("/:sessionId", protect, getStudySession);
router.post("/:sessionId/quiz", protect, submitStudyQuiz);

export default router;
