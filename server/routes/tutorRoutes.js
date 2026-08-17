import express from "express";

import {
  archiveTutorConversation,
  createTutorConversation,
  getTutorConversation,
  getTutorUsage,
  listTutorConversations,
  sendTutorMessage,
} from "../controllers/tutor.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/usage", protect, getTutorUsage);

router.get("/conversations", protect, listTutorConversations);
router.post("/conversations", protect, createTutorConversation);

router.get(
  "/conversations/:conversationId",
  protect,
  getTutorConversation,
);

router.delete(
  "/conversations/:conversationId",
  protect,
  archiveTutorConversation,
);

router.post(
  "/conversations/:conversationId/messages",
  protect,
  sendTutorMessage,
);

export default router;
