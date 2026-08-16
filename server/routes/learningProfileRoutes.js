import express from "express";

import {
  getLearningProfile,
  saveLearningProfile,
} from "../controllers/learningProfile.controller.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getLearningProfile);

router.put("/", protect, saveLearningProfile);

export default router;