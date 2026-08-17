import express from "express";

import {
  createPurchaseOrder,
  getPurchaseStatus,
  verifyPurchasePayment,
} from "../controllers/fluxGemPurchase.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/order", protect, createPurchaseOrder);
router.post("/verify", protect, verifyPurchasePayment);
router.get("/:purchaseId", protect, getPurchaseStatus);

export default router;
