import { isValidTimeZone, normalizeTimeZone } from "../utils/timezone.js";

const BOOL_KEYS = ["announcements", "community", "rewards"];

const serialize = (user) => ({
  timezone: normalizeTimeZone(user.timezone),
  emailPreferences: {
    announcements: user.settings?.emailPreferences?.announcements !== false,
    community: user.settings?.emailPreferences?.community === true,
    rewards: user.settings?.emailPreferences?.rewards !== false,
    support: user.settings?.emailPreferences?.support !== false,
    plannerReminders: user.settings?.emailPreferences?.plannerReminders !== false,
  },
  notificationPreferences: {
    announcements: user.settings?.notificationPreferences?.announcements !== false,
    community: user.settings?.notificationPreferences?.community !== false,
    rewards: user.settings?.notificationPreferences?.rewards !== false,
    system: user.settings?.notificationPreferences?.system !== false,
  },
});

export const getUserSettings = async (req, res) =>
  res.status(200).json({ success: true, data: serialize(req.user) });

export const updateUserSettings = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const user = req.user;

    if (typeof payload.timezone === "string") {
      const timezone = payload.timezone.trim();
      if (timezone && !isValidTimeZone(timezone)) {
        return res.status(400).json({ success: false, message: "Choose a valid timezone." });
      }
      user.timezone = timezone;
      user.timezoneUpdatedAt = timezone ? new Date() : null;
    }

    if (payload.emailPreferences && typeof payload.emailPreferences === "object") {
      for (const key of [...BOOL_KEYS, "support", "plannerReminders"]) {
        if (typeof payload.emailPreferences[key] === "boolean") {
          user.set(`settings.emailPreferences.${key}`, payload.emailPreferences[key]);
        }
      }
    }

    if (payload.notificationPreferences && typeof payload.notificationPreferences === "object") {
      for (const key of [...BOOL_KEYS, "system"]) {
        if (typeof payload.notificationPreferences[key] === "boolean") {
          user.set(`settings.notificationPreferences.${key}`, payload.notificationPreferences[key]);
        }
      }
    }

    await user.save();
    return res.status(200).json({ success: true, data: serialize(user) });
  } catch (error) {
    next(error);
  }
};
