import express from "express";

import { getMyLeaderboard } from "../controllers/leaderboard.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.get("/", protect, getMyLeaderboard);
export default router;
