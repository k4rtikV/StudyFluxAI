import StudyPlan from "../models/StudyPlan.js";
import User from "../models/User.js";
import { sendStudyPlanReminderEmail } from "./email.service.js";
import { getPlatformSettings } from "./platformSettings.service.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["planned", "in_progress"]);
const POLL_MS = Math.max(60_000, Number(process.env.STUDY_PLAN_REMINDER_POLL_MS || 300_000));
const LEASE_MS = Math.max(60_000, Number(process.env.STUDY_PLAN_REMINDER_LEASE_MS || 600_000));
const RETRY_MS = Math.max(60_000, Number(process.env.STUDY_PLAN_REMINDER_RETRY_MS || 900_000));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.STUDY_PLAN_REMINDER_MAX_ATTEMPTS || 5));
const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.STUDY_PLAN_REMINDER_BATCH_SIZE || 20)));

let timer = null;
let stopping = false;
let running = false;

const sameInstant = (left, right) => {
  const a = left ? new Date(left).getTime() : NaN;
  const b = right ? new Date(right).getTime() : NaN;
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
};

const clearPendingState = (plan) => {
  plan.reminder7dDueAt = null;
  plan.reminder7dClaimedAt = null;
  plan.reminder7dNextAttemptAt = null;
  plan.reminder7dLastError = "";
  if (!plan.reminder7dSentAt) {
    plan.reminder7dStatus = "not_scheduled";
    plan.reminder7dAttemptCount = 0;
  }
};

export const applyStudyPlanReminderSchedule = (
  plan,
  { now = new Date(), previousTargetAt = null, previousStatus = null } = {},
) => {
  const active = ACTIVE_STATUSES.has(plan.status);
  const targetAt = new Date(plan.targetAt);
  const targetValid = Number.isFinite(targetAt.getTime());
  const targetChanged = previousTargetAt
    ? !sameInstant(previousTargetAt, targetAt)
    : Boolean(plan.isNew);
  const wasActive = previousStatus ? ACTIVE_STATUSES.has(previousStatus) : false;

  if (!active || !targetValid) {
    clearPendingState(plan);
    return plan;
  }

  const alreadySentForTarget =
    plan.reminder7dSentAt && sameInstant(plan.reminder7dTargetAt, targetAt);

  // Active -> active status changes must not re-arm an already scheduled or
  // already delivered reminder. Re-arm only for a new target or a plan being
  // restored from a non-active state.
  const shouldRecalculate =
    plan.isNew ||
    targetChanged ||
    (!wasActive && previousStatus !== null) ||
    (!plan.reminder7dDueAt && !alreadySentForTarget && plan.reminder7dStatus === "not_scheduled");

  if (!shouldRecalculate) return plan;

  if (alreadySentForTarget && !targetChanged) {
    plan.reminder7dStatus = "sent";
    plan.reminder7dDueAt = null;
    plan.reminder7dClaimedAt = null;
    plan.reminder7dNextAttemptAt = null;
    return plan;
  }

  const dueAt = new Date(targetAt.getTime() - WEEK_MS);
  if (dueAt.getTime() < now.getTime()) {
    // The plan was created/rescheduled with less than a week remaining. Do not
    // send a misleading late "one week" reminder.
    plan.reminder7dTargetAt = targetAt;
    plan.reminder7dDueAt = null;
    plan.reminder7dStatus = "not_scheduled";
    plan.reminder7dAttemptCount = 0;
    plan.reminder7dClaimedAt = null;
    plan.reminder7dNextAttemptAt = null;
    plan.reminder7dSentAt = null;
    plan.reminder7dLastError = "";
    return plan;
  }

  plan.reminder7dTargetAt = targetAt;
  plan.reminder7dDueAt = dueAt;
  plan.reminder7dStatus = "pending";
  plan.reminder7dAttemptCount = 0;
  plan.reminder7dClaimedAt = null;
  plan.reminder7dNextAttemptAt = null;
  plan.reminder7dSentAt = null;
  plan.reminder7dLastError = "";
  return plan;
};

export const backfillStudyPlanReminders = async () => {
  const now = new Date();
  const earliestEligibleTarget = new Date(now.getTime() + WEEK_MS);
  let totalModified = 0;
  let afterId = null;

  while (true) {
    const query = {
      status: { $in: [...ACTIVE_STATUSES] },
      targetAt: { $gte: earliestEligibleTarget },
      reminder7dSentAt: null,
      $or: [
        { reminder7dStatus: { $exists: false } },
        { reminder7dStatus: "not_scheduled" },
        { reminder7dTargetAt: { $exists: false } },
      ],
      ...(afterId ? { _id: { $gt: afterId } } : {}),
    };

    const plans = await StudyPlan.find(query)
      .select("_id targetAt reminder7dSentAt")
      .sort({ _id: 1 })
      .limit(500)
      .lean();

    if (!plans.length) break;
    afterId = plans[plans.length - 1]._id;

    const operations = plans.map((plan) => ({
      updateOne: {
        filter: {
          _id: plan._id,
          status: { $in: [...ACTIVE_STATUSES] },
          targetAt: plan.targetAt,
          reminder7dSentAt: null,
        },
        update: {
          $set: {
            reminder7dTargetAt: plan.targetAt,
            reminder7dDueAt: new Date(new Date(plan.targetAt).getTime() - WEEK_MS),
            reminder7dStatus: "pending",
            reminder7dAttemptCount: 0,
            reminder7dClaimedAt: null,
            reminder7dNextAttemptAt: null,
            reminder7dLastError: "",
          },
        },
      },
    }));

    const result = await StudyPlan.bulkWrite(operations, { ordered: false });
    totalModified += Number(result.modifiedCount || 0);
    if (plans.length < 500) break;
  }

  return totalModified;
};

const claimDueReminder = async () => {
  const now = new Date();
  const staleClaim = new Date(now.getTime() - LEASE_MS);

  return StudyPlan.findOneAndUpdate(
    {
      status: { $in: [...ACTIVE_STATUSES] },
      targetAt: { $gt: now },
      reminder7dSentAt: null,
      reminder7dDueAt: { $ne: null, $lte: now },
      reminder7dAttemptCount: { $lt: MAX_ATTEMPTS },
      $and: [
        {
          $or: [
            { reminder7dNextAttemptAt: null },
            { reminder7dNextAttemptAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { reminder7dStatus: "pending" },
            {
              reminder7dStatus: "processing",
              reminder7dClaimedAt: { $lte: staleClaim },
            },
          ],
        },
      ],
    },
    {
      $set: {
        reminder7dStatus: "processing",
        reminder7dClaimedAt: now,
        reminder7dNextAttemptAt: null,
      },
      $inc: { reminder7dAttemptCount: 1 },
    },
    {
      sort: { reminder7dDueAt: 1 },
      returnDocument: "after",
    },
  ).lean();
};

const markSkipped = async (plan, reason) => {
  await StudyPlan.updateOne(
    {
      _id: plan._id,
      reminder7dStatus: "processing",
      reminder7dClaimedAt: plan.reminder7dClaimedAt,
    },
    {
      $set: {
        reminder7dStatus: "skipped",
        reminder7dDueAt: null,
        reminder7dClaimedAt: null,
        reminder7dNextAttemptAt: null,
        reminder7dLastError: String(reason || "Reminder skipped.").slice(0, 500),
      },
    },
  );
};

const processReminder = async (claimed) => {
  const current = await StudyPlan.findOne({
    _id: claimed._id,
    status: { $in: [...ACTIVE_STATUSES] },
    targetAt: claimed.targetAt,
    reminder7dTargetAt: claimed.reminder7dTargetAt,
    reminder7dDueAt: claimed.reminder7dDueAt,
    reminder7dStatus: "processing",
    reminder7dClaimedAt: claimed.reminder7dClaimedAt,
    reminder7dSentAt: null,
  }).lean();

  if (!current) return;

  const now = new Date();
  if (new Date(current.targetAt).getTime() <= now.getTime()) {
    await markSkipped(claimed, "Deadline already passed before reminder delivery.");
    return;
  }

  const [user, platform] = await Promise.all([
    User.findById(current.user)
      .select("fullName email role isActive timezone settings.emailPreferences.plannerReminders")
      .lean(),
    getPlatformSettings(),
  ]);

  if (!user || user.role !== "student" || !user.isActive || !user.email) {
    await markSkipped(claimed, "Learner account is unavailable for reminder delivery.");
    return;
  }

  if (platform.emailDeliveryEnabled === false) {
    await markSkipped(claimed, "Optional email delivery is disabled by platform settings.");
    return;
  }

  if (user.settings?.emailPreferences?.plannerReminders === false) {
    await markSkipped(claimed, "Learner disabled Study Planner reminder emails.");
    return;
  }

  try {
    await sendStudyPlanReminderEmail({
      email: user.email,
      fullName: user.fullName,
      timezone: user.timezone,
      title: current.title,
      topic: current.topic,
      goal: current.goal,
      targetAt: current.targetAt,
      durationMinutes: current.durationMinutes,
      priority: current.priority,
    });

    await StudyPlan.updateOne(
      {
        _id: current._id,
        status: { $in: [...ACTIVE_STATUSES] },
        targetAt: current.targetAt,
        reminder7dTargetAt: current.reminder7dTargetAt,
        reminder7dStatus: "processing",
        reminder7dClaimedAt: claimed.reminder7dClaimedAt,
        reminder7dSentAt: null,
      },
      {
        $set: {
          reminder7dStatus: "sent",
          reminder7dSentAt: new Date(),
          reminder7dDueAt: null,
          reminder7dClaimedAt: null,
          reminder7dNextAttemptAt: null,
          reminder7dLastError: "",
        },
      },
    );
  } catch (error) {
    const attempts = Number(claimed.reminder7dAttemptCount || 1);
    const exhausted = attempts >= MAX_ATTEMPTS;
    await StudyPlan.updateOne(
      {
        _id: claimed._id,
        reminder7dStatus: "processing",
        reminder7dClaimedAt: claimed.reminder7dClaimedAt,
      },
      {
        $set: {
          reminder7dStatus: exhausted ? "failed" : "pending",
          reminder7dClaimedAt: null,
          reminder7dNextAttemptAt: exhausted ? null : new Date(Date.now() + RETRY_MS),
          reminder7dLastError: String(error?.message || "Reminder email failed.").slice(0, 500),
        },
      },
    );
    console.warn("Study Planner 7-day reminder email failed:", error?.message || error);
  }
};

const runSweep = async () => {
  if (running || stopping) return;
  running = true;
  try {
    for (let count = 0; count < BATCH_SIZE && !stopping; count += 1) {
      const claimed = await claimDueReminder();
      if (!claimed) break;
      await processReminder(claimed);
    }
  } finally {
    running = false;
  }
};

const scheduleNext = (delay = POLL_MS) => {
  if (stopping) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await runSweep();
    } catch (error) {
      console.error("Study Planner reminder worker sweep failed:", error);
    } finally {
      scheduleNext();
    }
  }, delay);
  timer.unref?.();
};

export const startStudyPlanReminderWorker = async () => {
  stopping = false;
  try {
    const backfilled = await backfillStudyPlanReminders();
    if (backfilled > 0) {
      console.log(`Study Planner reminder worker armed ${backfilled} existing plan(s).`);
    }
  } catch (error) {
    console.error("Study Planner reminder backfill failed:", error);
  }

  await runSweep();
  scheduleNext();
};

export const stopStudyPlanReminderWorker = () => {
  stopping = true;
  if (timer) clearTimeout(timer);
  timer = null;
};
