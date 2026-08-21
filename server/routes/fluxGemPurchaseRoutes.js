import express from "express";

import {
  createPurchaseOrder,
  getPurchaseStatus,
  reconcilePurchaseStatus,
  verifyPurchasePayment,
} from "../controllers/fluxGemPurchase.controller.js";
import { protect } from "../middleware/auth.js";
import { purchaseRateLimit } from "../middleware/purchaseRateLimit.js";

const router = express.Router();

router.post(
  "/order",
  protect,
  purchaseRateLimit({ bucket: "order", limit: 10, windowMs: 60 * 60 * 1000 }),
  createPurchaseOrder,
);
router.post(
  "/verify",
  protect,
  purchaseRateLimit({ bucket: "verify", limit: 30, windowMs: 15 * 60 * 1000 }),
  verifyPurchasePayment,
);
router.post(
  "/:purchaseId/reconcile",
  protect,
  purchaseRateLimit({ bucket: "reconcile", limit: 20, windowMs: 15 * 60 * 1000 }),
  reconcilePurchaseStatus,
);
router.get("/:purchaseId", protect, getPurchaseStatus);

export default router;
