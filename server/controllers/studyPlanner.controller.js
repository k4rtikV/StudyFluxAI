import mongoose from "mongoose";

import StudyPlan from "../models/StudyPlan.js";
import StudySession from "../models/StudySession.js";
import { findRelatedStudyLibraryItems } from "../services/studyPlannerMatcher.service.js";
import { applyStudyPlanReminderSchedule } from "../services/studyPlanReminder.service.js";
import { createUserNotification } from "../services/notification.service.js";
import {
  validatePlannerMatchInput,
  validateStudyPlanInput,
} from "../utils/studyPlannerValidation.js";

const getSessionTitle = (session) =>
  session.output?.sessionTitle || session.topic || session.sourceFile?.fileName || "Learning item";

const serializeLibraryItem = (session) => ({
  id: session._id,
  generationType: session.generationType || "combined",
  origin: session.origin || "ai_generation",
  title: getSessionTitle(session),
  description: session.output?.shortDescription || "",
  topic: session.topic || "",
  hasNotes: Boolean(session.output?.notes),
  hasQuiz: Boolean(session.output?.quiz?.questions?.length),
  quizSize: Number(session.quizSize || 0),
  createdAt: session.createdAt,
});

const serializePlan = (plan) => ({
  id: plan._id,
  title: plan.title,
  topic: plan.topic,
  goal: plan.goal || "",
  targetAt: plan.targetAt,
  durationMinutes: Number(plan.durationMinutes || 60),
  priority: plan.priority,
  status: plan.status,
  completedAt: plan.completedAt || null,
  linkedStudySessions: Array.isArray(plan.linkedStudySessions)
    ? plan.linkedStudySessions.map((session) =>
        session && typeof session === "object" && session._id
          ? serializeLibraryItem(session)
          : { id: session },
      )
    : [],
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

const populatePlan = (query) =>
  query.populate({
    path: "linkedStudySessions",
    select:
      "generationType origin topic sourceFile quizSize output.sessionTitle output.shortDescription output.notes output.quiz createdAt",
  });

const resolveOwnedLinkedSessions = async (userId, ids = []) => {
  if (!ids.length) return [];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return null;

  const sessions = await StudySession.find({
    _id: { $in: ids },
    user: userId,
    status: "completed",
  })
    .select("_id")
    .lean();

  if (sessions.length !== ids.length) return null;
  return ids;
};

export const listStudyPlans = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (["planned", "in_progress", "completed"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const plans = await populatePlan(
      StudyPlan.find(filter).sort({ status: 1, targetAt: 1, createdAt: -1 }),
    ).lean();

    return res.status(200).json({
      success: true,
      data: { studyPlans: plans.map(serializePlan) },
    });
  } catch (error) {
    next(error);
  }
};

export const getStudyPlannerSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const activeFilter = {
      user: req.user._id,
      status: { $in: ["planned", "in_progress"] },
    };

    const [activeCount, upcomingCount, overdueCount, nextPlan, overduePlan] = await Promise.all([
      StudyPlan.countDocuments(activeFilter),
      StudyPlan.countDocuments({ ...activeFilter, targetAt: { $gte: now } }),
      StudyPlan.countDocuments({ ...activeFilter, targetAt: { $lt: now } }),
      StudyPlan.findOne({ ...activeFilter, targetAt: { $gte: now } })
        .sort({ targetAt: 1 })
        .select("title topic targetAt durationMinutes priority status")
        .lean(),
      StudyPlan.findOne({ ...activeFilter, targetAt: { $lt: now } })
        .sort({ targetAt: 1 })
        .select("title topic targetAt priority status")
        .lean(),
    ]);

    if (nextPlan && new Date(nextPlan.targetAt).getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
      createUserNotification({
        userId: req.user._id,
        type: "system",
        title: "Study plan coming up",
        body: `${nextPlan.title} is scheduled within the next 24 hours.`,
        actionUrl: "/planner",
        actionLabel: "Open Planner",
        priority: nextPlan.priority === "high" ? "high" : "normal",
        dedupeKey: `planner:${String(nextPlan._id)}:${new Date(nextPlan.targetAt).toISOString()}:upcoming`,
        emailRequested: false,
        metadata: { studyPlanId: String(nextPlan._id), kind: "upcoming" },
      }).catch(() => {});
    }

    if (overduePlan) {
      createUserNotification({
        userId: req.user._id,
        type: "system",
        title: "A study plan is overdue",
        body: `${overduePlan.title} has passed its target time. Reschedule it or mark it complete.`,
        actionUrl: "/planner",
        actionLabel: "Review plan",
        priority: overduePlan.priority === "high" ? "high" : "normal",
        dedupeKey: `planner:${String(overduePlan._id)}:${new Date(overduePlan.targetAt).toISOString()}:overdue`,
        emailRequested: false,
        metadata: { studyPlanId: String(overduePlan._id), kind: "overdue" },
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: {
        activeCount,
        upcomingCount,
        overdueCount,
        nextPlan: nextPlan
          ? {
              id: nextPlan._id,
              title: nextPlan.title,
              topic: nextPlan.topic,
              targetAt: nextPlan.targetAt,
              durationMinutes: Number(nextPlan.durationMinutes || 60),
              priority: nextPlan.priority,
              status: nextPlan.status,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStudyPlannerMatches = async (req, res, next) => {
  const validation = validatePlannerMatchInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PLANNER_MATCH_INPUT",
      message: "Enter a topic to find related Study Library material.",
      errors: validation.errors,
    });
  }

  try {
    const suggestions = await findRelatedStudyLibraryItems({
      userId: req.user._id,
      ...validation.values,
    });

    return res.status(200).json({
      success: true,
      data: {
        suggestions,
        matcher: "local_deterministic",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStudyPlan = async (req, res, next) => {
  const validation = validateStudyPlanInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STUDY_PLAN",
      message: "Please correct the study plan details.",
      errors: validation.errors,
    });
  }

  try {
    const linkedStudySessions = await resolveOwnedLinkedSessions(
      req.user._id,
      validation.values.linkedStudySessionIds,
    );

    if (linkedStudySessions === null) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STUDY_PLAN_LINKS",
        message: "One or more selected Study Library items are unavailable.",
      });
    }

    const plan = new StudyPlan({
      user: req.user._id,
      title: validation.values.title,
      topic: validation.values.topic,
      goal: validation.values.goal,
      targetAt: validation.values.targetAt,
      durationMinutes: validation.values.durationMinutes,
      priority: validation.values.priority,
      linkedStudySessions,
    });
    applyStudyPlanReminderSchedule(plan);
    await plan.save();

    const populated = await populatePlan(StudyPlan.findById(plan._id)).lean();

    return res.status(201).json({
      success: true,
      message: "Study plan created.",
      data: { studyPlan: serializePlan(populated) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudyPlan = async (req, res, next) => {
  const { planId } = req.params;
  if (!mongoose.isValidObjectId(planId)) {
    return res.status(404).json({ success: false, code: "STUDY_PLAN_NOT_FOUND", message: "Study plan not found." });
  }

  const validation = validateStudyPlanInput(req.body, { partial: true });
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "INVALID_STUDY_PLAN",
      message: "Please correct the study plan details.",
      errors: validation.errors,
    });
  }

  try {
    const plan = await StudyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ success: false, code: "STUDY_PLAN_NOT_FOUND", message: "Study plan not found." });
    }

    const previousTargetAt = plan.targetAt ? new Date(plan.targetAt) : null;
    const previousStatus = plan.status;

    const { linkedStudySessionIds, ...updates } = validation.values;
    if (linkedStudySessionIds !== undefined) {
      const linked = await resolveOwnedLinkedSessions(req.user._id, linkedStudySessionIds);
      if (linked === null) {
        return res.status(400).json({
          success: false,
          code: "INVALID_STUDY_PLAN_LINKS",
          message: "One or more selected Study Library items are unavailable.",
        });
      }
      plan.linkedStudySessions = linked;
    }

    Object.assign(plan, updates);

    if (updates.status === "completed" && !plan.completedAt) plan.completedAt = new Date();
    if (updates.status && updates.status !== "completed") plan.completedAt = null;

    applyStudyPlanReminderSchedule(plan, { previousTargetAt, previousStatus });
    await plan.save();

    const populated = await populatePlan(StudyPlan.findById(plan._id)).lean();
    return res.status(200).json({
      success: true,
      message: "Study plan updated.",
      data: { studyPlan: serializePlan(populated) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStudyPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    if (!mongoose.isValidObjectId(planId)) {
      return res.status(404).json({ success: false, code: "STUDY_PLAN_NOT_FOUND", message: "Study plan not found." });
    }

    const deleted = await StudyPlan.findOneAndDelete({ _id: planId, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, code: "STUDY_PLAN_NOT_FOUND", message: "Study plan not found." });
    }

    return res.status(200).json({ success: true, message: "Study plan deleted." });
  } catch (error) {
    next(error);
  }
};
