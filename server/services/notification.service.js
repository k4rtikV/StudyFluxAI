import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendNotificationEmail } from "./email.service.js";
import { getPlatformSettings } from "./platformSettings.service.js";

const preferenceKeyForType = (type) => {
  if (type === "announcement") return "announcements";
  if (type === "community") return "community";
  if (type === "reward") return "rewards";
  return "system";
};

const defaultEmailPreference = (key) => {
  if (key === "community") return false;
  return true;
};

const readPreference = (settings, group, key, fallback) => {
  const value = settings?.[group]?.[key];
  return typeof value === "boolean" ? value : fallback;
};

const normalizePayload = (payload) => ({
  type: ["announcement", "community", "reward", "system", "support"].includes(payload.type)
    ? payload.type
    : "system",
  title: String(payload.title || "StudyFluxAI update").trim().slice(0, 180),
  body: String(payload.body || "").trim().slice(0, 1200),
  actionUrl: String(payload.actionUrl || "").trim().slice(0, 500),
  actionLabel: String(payload.actionLabel || "").trim().slice(0, 80),
  priority: ["low", "normal", "high", "urgent"].includes(payload.priority)
    ? payload.priority
    : "normal",
  dedupeKey: String(payload.dedupeKey || "").trim().slice(0, 220),
  metadata: payload.metadata || {},
});

const sendPendingEmails = async (notifications) => {
  const pending = notifications.filter(
    (item) => item.channels?.email && !item.emailSentAt,
  );

  for (let index = 0; index < pending.length; index += 10) {
    const chunk = pending.slice(index, index + 10);
    await Promise.allSettled(
      chunk.map(async (notification) => {
        const user = notification.user;
        if (!user?.email) return;
        try {
          await sendNotificationEmail({
            email: user.email,
            fullName: user.fullName,
            title: notification.title,
            body: notification.body,
            actionUrl: notification.actionUrl,
            actionLabel: notification.actionLabel,
          });
          await Notification.updateOne(
            { _id: notification._id, emailSentAt: null },
            { $set: { emailSentAt: new Date(), emailFailedAt: null } },
          );
        } catch (error) {
          await Notification.updateOne(
            { _id: notification._id, emailSentAt: null },
            { $set: { emailFailedAt: new Date() } },
          );
          console.warn("Notification email delivery failed:", error.message);
        }
      }),
    );
  }
};

export const createUserNotification = async ({
  userId,
  emailRequested = false,
  ...payload
}) => {
  const normalized = normalizePayload(payload);
  if (!normalized.body || !normalized.dedupeKey) return null;

  const [user, platform] = await Promise.all([
    User.findById(userId)
      .select("fullName email role isActive settings")
      .lean(),
    getPlatformSettings(),
  ]);

  if (!user || !user.isActive || user.role !== "student") return null;

  const key = preferenceKeyForType(normalized.type);
  const inApp = readPreference(
    user.settings,
    "notificationPreferences",
    key,
    true,
  );
  const email =
    Boolean(emailRequested) &&
    platform.emailDeliveryEnabled !== false &&
    readPreference(
      user.settings,
      "emailPreferences",
      key,
      defaultEmailPreference(key),
    );

  if (!inApp && !email) return null;

  await Notification.updateOne(
    { user: user._id, dedupeKey: normalized.dedupeKey },
    {
      $setOnInsert: {
        user: user._id,
        ...normalized,
        channels: { inApp, email },
      },
    },
    { upsert: true },
  );

  const notification = await Notification.findOne({
    user: user._id,
    dedupeKey: normalized.dedupeKey,
  }).populate("user", "fullName email");

  if (notification?.channels?.email && !notification.emailSentAt) {
    await sendPendingEmails([notification]);
  }

  return notification;
};

export const broadcastNotification = async ({
  emailRequested = false,
  ...payload
}) => {
  const normalized = normalizePayload(payload);
  if (!normalized.body || !normalized.dedupeKey) {
    return { recipients: 0, inAppRecipients: 0, emailRecipients: 0, emailSent: 0 };
  }

  const [users, platform] = await Promise.all([
    User.find({ role: "student", isActive: true })
      .select("fullName email settings")
      .lean(),
    getPlatformSettings(),
  ]);

  const key = preferenceKeyForType(normalized.type);
  const rows = users
    .map((user) => {
      const inApp = readPreference(
        user.settings,
        "notificationPreferences",
        key,
        true,
      );
      const email =
        Boolean(emailRequested) &&
        platform.emailDeliveryEnabled !== false &&
        readPreference(
          user.settings,
          "emailPreferences",
          key,
          defaultEmailPreference(key),
        );
      return { user, inApp, email };
    })
    .filter((row) => row.inApp || row.email);

  if (!rows.length) {
    return { recipients: 0, inAppRecipients: 0, emailRecipients: 0, emailSent: 0 };
  }

  try {
    await Notification.bulkWrite(
      rows.map(({ user, inApp, email }) => ({
        updateOne: {
          filter: { user: user._id, dedupeKey: normalized.dedupeKey },
          update: {
            $setOnInsert: {
              user: user._id,
              ...normalized,
              channels: { inApp, email },
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (error) {
    // Concurrent publishers can race on the unique user+dedupeKey index.
    // The duplicate means the notification already exists, so only surface
    // genuinely different write failures.
    if (error?.code !== 11000) throw error;
  }

  const notificationDocs = await Notification.find({
    dedupeKey: normalized.dedupeKey,
    user: { $in: rows.map((row) => row.user._id) },
  }).populate("user", "fullName email");

  await sendPendingEmails(notificationDocs);
  const sentCount = await Notification.countDocuments({
    dedupeKey: normalized.dedupeKey,
    user: { $in: rows.map((row) => row.user._id) },
    emailSentAt: { $ne: null },
  });

  return {
    recipients: rows.length,
    inAppRecipients: rows.filter((row) => row.inApp).length,
    emailRecipients: rows.filter((row) => row.email).length,
    emailSent: sentCount,
  };
};

export const broadcastCommunityPublication = async ({ kind, item }) => {
  const platform = await getPlatformSettings();
  const isChallenge = kind === "challenge";
  return broadcastNotification({
    type: "community",
    title: isChallenge ? "A new Daily Challenge is live" : "A new Community Poll is live",
    body: isChallenge
      ? `${String(item.question || "A new challenge").slice(0, 180)} · Earn XP and FluxGems for a correct answer.`
      : String(item.question || "Cast your vote in the latest StudyFluxAI community poll.").slice(0, 240),
    actionUrl: "/daily-challenges",
    actionLabel: isChallenge ? "Take challenge" : "View poll",
    priority: "normal",
    dedupeKey: `community:${kind}:${String(item._id || item.id)}:published`,
    emailRequested: Boolean(platform.communityEmailEnabled),
    metadata: { kind, contentId: String(item._id || item.id) },
  });
};

export const notifyFluxGemRewards = async ({ userId, granted = [] }) => {
  const normalized = granted
    .map((reward) => ({ ...reward, amount: Number(reward.amount || 0) }))
    .filter((reward) => reward.amount > 0 && reward.rewardKey);
  if (!normalized.length) return;

  if (normalized.length === 1) {
    const reward = normalized[0];
    await createUserNotification({
      userId,
      type: "reward",
      title: `+${reward.amount} FluxGems earned`,
      body: String(reward.metadata?.label || "A StudyFluxAI reward was added to your wallet."),
      actionUrl: "/wallet",
      actionLabel: "View wallet",
      priority: "normal",
      dedupeKey: `reward:${reward.rewardKey}`,
      emailRequested: true,
      metadata: { ...reward.metadata, amount: reward.amount },
    }).catch((error) => {
      console.warn("Reward notification delivery failed:", error.message);
    });
    return;
  }

  const total = normalized.reduce((sum, reward) => sum + reward.amount, 0);
  const key = normalized.map((reward) => reward.rewardKey).sort().join("|");
  await createUserNotification({
    userId,
    type: "reward",
    title: `+${total} FluxGems in rewards`,
    body: `${normalized.length} one-time StudyFluxAI rewards were added to your wallet.`,
    actionUrl: "/wallet",
    actionLabel: "View rewards",
    priority: "normal",
    dedupeKey: `reward-batch:${key}`.slice(0, 220),
    emailRequested: true,
    metadata: { amount: total, rewardKeys: normalized.map((reward) => reward.rewardKey) },
  }).catch((error) => {
    console.warn("Reward notification delivery failed:", error.message);
  });
};
