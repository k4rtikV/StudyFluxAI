const PRIORITIES = new Set(["low", "medium", "high"]);
const STATUSES = new Set(["planned", "in_progress", "completed"]);

const cleanText = (value, maxLength = 500) =>
  String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const parseLinkedIds = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const ids = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  return ids.length <= 12 ? ids : null;
};

export const validateStudyPlanInput = (body = {}, { partial = false } = {}) => {
  const errors = {};
  const values = {};

  const assignRequiredText = (key, label, maxLength) => {
    if (body[key] === undefined && partial) return;
    const value = cleanText(body[key], maxLength);
    if (value.length < 2) errors[key] = `${label} must be at least 2 characters.`;
    else values[key] = value;
  };

  assignRequiredText("title", "Plan title", 160);
  assignRequiredText("topic", "Topic", 180);

  if (body.goal !== undefined || !partial) {
    values.goal = cleanText(body.goal, 600);
  }

  if (body.targetAt !== undefined || !partial) {
    const targetAt = new Date(body.targetAt);
    if (!body.targetAt || Number.isNaN(targetAt.getTime())) {
      errors.targetAt = "Choose a valid target date and time.";
    } else {
      values.targetAt = targetAt;
    }
  }

  if (body.durationMinutes !== undefined || !partial) {
    const duration = Number(body.durationMinutes ?? 60);
    if (!Number.isInteger(duration) || duration < 15 || duration > 720) {
      errors.durationMinutes = "Study duration must be between 15 and 720 minutes.";
    } else {
      values.durationMinutes = duration;
    }
  }

  if (body.priority !== undefined || !partial) {
    const priority = String(body.priority || "medium");
    if (!PRIORITIES.has(priority)) errors.priority = "Choose a valid priority.";
    else values.priority = priority;
  }

  if (body.status !== undefined) {
    const status = String(body.status || "");
    if (!STATUSES.has(status)) errors.status = "Choose a valid plan status.";
    else values.status = status;
  }

  if (body.linkedStudySessionIds !== undefined || !partial) {
    const linkedStudySessionIds = parseLinkedIds(body.linkedStudySessionIds ?? []);
    if (linkedStudySessionIds === null) {
      errors.linkedStudySessionIds = "Choose up to 12 Study Library items.";
    } else {
      values.linkedStudySessionIds = linkedStudySessionIds;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values,
  };
};

export const validatePlannerMatchInput = (body = {}) => {
  const topic = cleanText(body.topic, 180);
  const title = cleanText(body.title, 160);
  const goal = cleanText(body.goal, 600);

  if (topic.length < 2 && title.length < 2) {
    return {
      valid: false,
      errors: { topic: "Enter a topic or plan title to find related material." },
      values: {},
    };
  }

  return {
    valid: true,
    errors: {},
    values: { topic, title, goal },
  };
};
