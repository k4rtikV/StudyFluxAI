import express from "express";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);
export default router;
