import mongoose from "mongoose";

import Announcement from "../models/Announcement.js";
import { broadcastNotification } from "./notification.service.js";
import { getPlatformSettings } from "./platformSettings.service.js";

const httpError = (message, statusCode = 400, code = "ANNOUNCEMENT_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const cleanText = (value, maxLength, label, required = true) => {
  const text = String(value ?? "").trim();
  if (required && !text) throw httpError(`${label} is required.`);
  if (text.length > maxLength) throw httpError(`${label} is too long.`);
  return text;
};

const normalizeActionUrl = (value) => {
  const url = cleanText(value || "", 500, "Action URL", false);
  if (!url) return "";
  if (!url.startsWith("/")) {
    throw httpError("Announcement action URL must be an in-app path beginning with /.");
  }
  return url;
};

const serialize = (item) => ({
  id: String(item._id),
  title: item.title,
  body: item.body,
  priority: item.priority,
  actionLabel: item.actionLabel || "",
  actionUrl: item.actionUrl || "",
  emailDelivery: Boolean(item.emailDelivery),
  status: item.status,
  publishedAt: item.publishedAt || null,
  archivedAt: item.archivedAt || null,
  recipientCount: Number(item.recipientCount || 0),
  emailSentCount: Number(item.emailSentCount || 0),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const announcementPayload = async (payload, existing = null) => {
  const platform = await getPlatformSettings();
  return {
    title: cleanText(payload.title ?? existing?.title, 180, "Title"),
    body: cleanText(payload.body ?? existing?.body, 3000, "Message"),
    priority: ["low", "normal", "high", "urgent"].includes(payload.priority)
      ? payload.priority
      : existing?.priority || "normal",
    actionLabel: cleanText(
      payload.actionLabel ?? existing?.actionLabel ?? "",
      80,
      "Action label",
      false,
    ),
    actionUrl: normalizeActionUrl(payload.actionUrl ?? existing?.actionUrl ?? ""),
    emailDelivery:
      typeof payload.emailDelivery === "boolean"
        ? payload.emailDelivery
        : existing
          ? Boolean(existing.emailDelivery)
          : Boolean(platform.announcementEmailDefault),
  };
};

export const listAnnouncements = async () => {
  const items = await Announcement.find().sort({ createdAt: -1 }).lean();
  return items.map(serialize);
};

export const createAnnouncement = async ({ adminId, payload }) => {
  const data = await announcementPayload(payload || {});
  const item = await Announcement.create({ ...data, createdBy: adminId });
  if (payload?.publishNow === true) {
    return publishAnnouncement(String(item._id));
  }
  return serialize(item.toObject());
};

export const updateAnnouncement = async ({ announcementId, payload }) => {
  if (!mongoose.isValidObjectId(announcementId)) throw httpError("Invalid announcement.");
  const item = await Announcement.findById(announcementId);
  if (!item) throw httpError("Announcement not found.", 404);
  if (item.status !== "draft") {
    throw httpError("Published announcements are immutable. Archive it and create a new announcement instead.", 409);
  }
  Object.assign(item, await announcementPayload(payload || {}, item));
  await item.save();
  return serialize(item.toObject());
};

export const publishAnnouncement = async (announcementId) => {
  if (!mongoose.isValidObjectId(announcementId)) throw httpError("Invalid announcement.");
  const item = await Announcement.findById(announcementId);
  if (!item) throw httpError("Announcement not found.", 404);
  if (item.status === "archived") throw httpError("Archived announcements cannot be republished.", 409);

  if (item.status !== "published") {
    item.status = "published";
    item.publishedAt = new Date();
    await item.save();
  }

  const delivery = await broadcastNotification({
    type: "announcement",
    title: item.title,
    body: item.body,
    actionUrl: item.actionUrl,
    actionLabel: item.actionLabel,
    priority: item.priority,
    dedupeKey: `announcement:${item._id}:published`,
    emailRequested: Boolean(item.emailDelivery),
    metadata: { announcementId: String(item._id) },
  });

  item.recipientCount = Number(delivery.inAppRecipients || 0);
  item.emailSentCount = Number(delivery.emailSent || 0);
  await item.save();
  return serialize(item.toObject());
};

export const archiveAnnouncement = async (announcementId) => {
  if (!mongoose.isValidObjectId(announcementId)) throw httpError("Invalid announcement.");
  const item = await Announcement.findById(announcementId);
  if (!item) throw httpError("Announcement not found.", 404);
  item.status = "archived";
  item.archivedAt = new Date();
  await item.save();
  return serialize(item.toObject());
};

export const deleteDraftAnnouncement = async (announcementId) => {
  if (!mongoose.isValidObjectId(announcementId)) throw httpError("Invalid announcement.");
  const item = await Announcement.findById(announcementId);
  if (!item) throw httpError("Announcement not found.", 404);
  if (item.status !== "draft") {
    throw httpError("Only draft announcements can be deleted.", 409);
  }
  await item.deleteOne();
  return { id: String(item._id) };
};
