import express from "express";

import {
  createStudyPlan,
  deleteStudyPlan,
  getStudyPlannerMatches,
  getStudyPlannerSummary,
  listStudyPlans,
  updateStudyPlan,
} from "../controllers/studyPlanner.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/", listStudyPlans);
router.get("/summary", getStudyPlannerSummary);
router.post("/matches", getStudyPlannerMatches);
router.post("/", createStudyPlan);
router.patch("/:planId", updateStudyPlan);
router.delete("/:planId", deleteStudyPlan);

export default router;
