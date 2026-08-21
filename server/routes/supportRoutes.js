import express from "express";
import { getConfig, submitRequest } from "../controllers/support.controller.js";
import { protect } from "../middleware/auth.js";
import { supportRateLimit } from "../middleware/supportRateLimit.js";

const router = express.Router();
router.use(protect);
router.get("/config", getConfig);
router.post("/requests", supportRateLimit, submitRequest);
export default router;