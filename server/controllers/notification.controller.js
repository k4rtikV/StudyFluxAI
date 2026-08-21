import mongoose from "mongoose";

import Notification from "../models/Notification.js";

const serialize = (item) => ({
  id: String(item._id),
  type: item.type,
  title: item.title,
  body: item.body,
  actionUrl: item.actionUrl || "",
  actionLabel: item.actionLabel || "",
  priority: item.priority,
  readAt: item.readAt || null,
  createdAt: item.createdAt,
  metadata: item.metadata || {},
});

export const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const unreadOnly = String(req.query.unreadOnly || "false") === "true";
    const filter = { user: req.user._id, "channels.inApp": true };
    if (unreadOnly) filter.readAt = null;

    const [items, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({
        user: req.user._id,
        "channels.inApp": true,
        readAt: null,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: { notifications: items.map(serialize), unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) {
      return res.status(400).json({ success: false, message: "Invalid notification." });
    }
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user._id, "channels.inApp": true },
      { $set: { readAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }
    return res.status(200).json({ success: true, data: { notification: serialize(item) } });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, "channels.inApp": true, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return res.status(200).json({ success: true, data: { unreadCount: 0 } });
  } catch (error) {
    next(error);
  }
};
