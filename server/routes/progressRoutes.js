import express from "express";

import { getMyProgressOverview } from "../controllers/progress.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/overview", protect, getMyProgressOverview);

export default router;
