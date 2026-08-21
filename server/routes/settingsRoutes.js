import express from "express";
import { getUserSettings, updateUserSettings } from "../controllers/userSettings.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", getUserSettings);
router.patch("/", updateUserSettings);
export default router;
