import { isValidEmail, normalizeEmail } from "../utils/authValidation.js";
import { getPlatformSettings, serializePlatformSettings } from "../services/platformSettings.service.js";

export const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    return res.status(200).json({ success: true, data: serializePlatformSettings(settings) });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSettings = async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const payload = req.body || {};

    if (typeof payload.supportEmail === "string") {
      const email = normalizeEmail(payload.supportEmail);
      if (email && !isValidEmail(email)) {
        return res.status(400).json({ success: false, message: "Enter a valid support inbox email." });
      }
      settings.supportEmail = email;
    }

    if (typeof payload.supportFormEnabled === "boolean") settings.supportFormEnabled = payload.supportFormEnabled;
    if (typeof payload.emailDeliveryEnabled === "boolean") settings.emailDeliveryEnabled = payload.emailDeliveryEnabled;
    if (typeof payload.announcementEmailDefault === "boolean") settings.announcementEmailDefault = payload.announcementEmailDefault;
    if (typeof payload.communityEmailEnabled === "boolean") settings.communityEmailEnabled = payload.communityEmailEnabled;

    if (payload.supportResponseSlaHours !== undefined) {
      const hours = Number(payload.supportResponseSlaHours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
        return res.status(400).json({ success: false, message: "Support response target must be between 1 and 168 hours." });
      }
      settings.supportResponseSlaHours = hours;
    }

    if (settings.supportFormEnabled && !isValidEmail(settings.supportEmail)) {
      return res.status(400).json({
        success: false,
        message: "Configure a valid support inbox before enabling the in-app support form.",
      });
    }

    settings.updatedBy = req.user._id;
    await settings.save();
    return res.status(200).json({ success: true, data: serializePlatformSettings(settings) });
  } catch (error) {
    next(error);
  }
};
