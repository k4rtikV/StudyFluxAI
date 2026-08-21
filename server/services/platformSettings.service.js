import PlatformSettings from "../models/PlatformSettings.js";

const normalizeEnvEmail = (value) => String(value || "").trim().toLowerCase();

const explicitSupportEmail = () => normalizeEnvEmail(process.env.SUPPORT_INBOX_EMAIL);
const brevoSenderEmail = () => normalizeEnvEmail(process.env.BREVO_SENDER_EMAIL);
const legacyAdminSeedEmail = () => normalizeEnvEmail(process.env.ADMIN_SEED_EMAIL);

const fallbackSupportEmail = () => explicitSupportEmail() || brevoSenderEmail();

export const getPlatformSettings = async () => {
  let settings = await PlatformSettings.findOne({ key: "global" });

  if (!settings) {
    try {
      settings = await PlatformSettings.create({
        key: "global",
        supportEmail: fallbackSupportEmail(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      settings = await PlatformSettings.findOne({ key: "global" });
    }
  } else {
    const explicit = explicitSupportEmail();
    const sender = brevoSenderEmail();
    const legacyAdmin = legacyAdminSeedEmail();
    const current = normalizeEnvEmail(settings.supportEmail);

    // Phase 1 originally allowed ADMIN_SEED_EMAIL to become the support inbox.
    // Migrate that generated default to the verified Brevo mailbox unless an
    // explicit SUPPORT_INBOX_EMAIL has been configured.
    const shouldMigrateLegacyAdminFallback =
      !explicit &&
      sender &&
      legacyAdmin &&
      current === legacyAdmin &&
      current !== sender;

    if (!current && fallbackSupportEmail()) {
      settings.supportEmail = fallbackSupportEmail();
      await settings.save();
    } else if (shouldMigrateLegacyAdminFallback) {
      settings.supportEmail = sender;
      await settings.save();
    }
  }

  return settings;
};

export const serializePlatformSettings = (settings) => ({
  supportEmail: settings.supportEmail || fallbackSupportEmail(),
  supportFormEnabled: settings.supportFormEnabled !== false,
  supportResponseSlaHours: Number(settings.supportResponseSlaHours || 48),
  emailDeliveryEnabled: settings.emailDeliveryEnabled !== false,
  announcementEmailDefault: Boolean(settings.announcementEmailDefault),
  communityEmailEnabled: Boolean(settings.communityEmailEnabled),
  updatedAt: settings.updatedAt || null,
});
