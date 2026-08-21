import SupportRequest from "../models/SupportRequest.js";
import SupportRateSlot from "../models/SupportRateSlot.js";
import { sendSupportConfirmationEmail, sendSupportRequestEmail } from "./email.service.js";
import { getPlatformSettings } from "./platformSettings.service.js";
import { createUserNotification } from "./notification.service.js";

const httpError = (message, statusCode = 400, code = "SUPPORT_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const clean = (value, max, label) => {
  const text = String(value || "").trim();
  if (!text) throw httpError(`${label} is required.`);
  if (text.length > max) throw httpError(`${label} is too long.`);
  return text;
};


const SUPPORT_DELIVERY_LIMIT = 3;
const SUPPORT_BUCKET_MS = 60 * 60 * 1000;

const acquireSupportDeliverySlot = async (userId) => {
  const nowMs = Date.now();
  const bucketStart = new Date(Math.floor(nowMs / SUPPORT_BUCKET_MS) * SUPPORT_BUCKET_MS);
  const expiresAt = new Date(bucketStart.getTime() + SUPPORT_BUCKET_MS + 5 * 60 * 1000);

  for (let slot = 0; slot < SUPPORT_DELIVERY_LIMIT; slot += 1) {
    try {
      return await SupportRateSlot.create({ user: userId, bucketStart, slot, expiresAt });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  throw httpError(
    "You have sent several support requests recently. Please wait before sending another.",
    429,
    "SUPPORT_RATE_LIMITED",
  );
};

const getSupportDeliveryConfig = async () => {
  const settings = await getPlatformSettings();
  return {
    supportEmail: settings.supportEmail || "",
    supportFormEnabled: settings.supportFormEnabled !== false,
    supportResponseSlaHours: Number(settings.supportResponseSlaHours || 48),
  };
};

export const getSupportConfig = async () => {
  const config = await getSupportDeliveryConfig();
  return {
    supportFormEnabled: config.supportFormEnabled,
    supportResponseSlaHours: config.supportResponseSlaHours,
  };
};

export const submitSupportRequest = async ({ user, payload }) => {
  const config = await getSupportDeliveryConfig();
  if (!config.supportFormEnabled) {
    throw httpError("The in-app support form is temporarily unavailable.", 503, "SUPPORT_FORM_DISABLED");
  }
  if (!config.supportEmail) {
    throw httpError("Support email is not configured yet.", 503, "SUPPORT_EMAIL_NOT_CONFIGURED");
  }

  const category = ["account", "billing", "generation", "interview", "technical", "feedback", "other"].includes(payload?.category)
    ? payload.category
    : "other";
  const subject = clean(payload?.subject, 160, "Subject");
  const message = clean(payload?.message, 5000, "Message");
  const deliverySlot = await acquireSupportDeliverySlot(user._id);

  let request;
  try {
    request = await SupportRequest.create({
      user: user._id,
      email: user.email,
      fullName: user.fullName,
      category,
      subject,
      message,
    });
  } catch (error) {
    await SupportRateSlot.deleteOne({ _id: deliverySlot._id }).catch(() => {});
    throw error;
  }

  try {
    await sendSupportRequestEmail({
      supportEmail: config.supportEmail,
      userEmail: user.email,
      fullName: user.fullName,
      category,
      subject,
      message,
      requestId: String(request._id),
    });
    request.emailDeliveryStatus = "sent";
    request.emailError = "";
    await request.save();
  } catch (error) {
    request.emailDeliveryStatus = "failed";
    request.emailError = String(error.message || "Email delivery failed.").slice(0, 500);
    await request.save();
    await SupportRateSlot.deleteOne({ _id: deliverySlot._id }).catch(() => {});
    throw httpError(
      "Your request was saved, but the support email could not be delivered. Please try again later.",
      503,
      "SUPPORT_EMAIL_FAILED",
    );
  }

  createUserNotification({
    userId: user._id,
    type: "support",
    title: "Support request sent",
    body: `Your request “${subject}” was delivered to the StudyFluxAI administrator. Reference: ${String(request._id)}`,
    actionUrl: "/help",
    actionLabel: "Open Help & Support",
    priority: "normal",
    dedupeKey: `support:${String(request._id)}:submitted`,
    emailRequested: false,
    metadata: { supportRequestId: String(request._id) },
  }).catch((error) => console.warn("Support notification failed:", error.message));

  const wantsConfirmation = user.settings?.emailPreferences?.support !== false;
  if (wantsConfirmation) {
    sendSupportConfirmationEmail({
      email: user.email,
      fullName: user.fullName,
      subject,
      requestId: String(request._id),
    }).catch((error) => console.warn("Support confirmation email failed:", error.message));
  }

  return {
    id: String(request._id),
    createdAt: request.createdAt,
    status: request.status,
  };
};