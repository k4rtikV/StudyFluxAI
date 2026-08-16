import express from "express";

import { getFluxGemActivity } from "../controllers/fluxGem.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/activity", protect, getFluxGemActivity);

export default router;
