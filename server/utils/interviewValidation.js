const EXPERIENCE_LEVELS = new Set(["fresher", "entry", "junior", "mid", "senior"]);
const INTERVIEW_TYPES = new Set(["behavioral", "technical", "coding", "mixed"]);

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

export const validateInterviewStartInput = (body = {}) => {
  const values = {
    targetRole: cleanText(body.targetRole, 100),
    experienceLevel: cleanText(body.experienceLevel, 30).toLowerCase(),
    interviewType: cleanText(body.interviewType, 30).toLowerCase(),
    startRequestId: cleanText(body.startRequestId, 120),
    audioReady: String(body.audioReady || "").toLowerCase() === "true",
    networkReady: String(body.networkReady || "").toLowerCase() === "true",
    averageLatencyMs: Math.max(0, Math.min(60_000, Number(body.averageLatencyMs || 0))),
    jitterMs: Math.max(0, Math.min(60_000, Number(body.jitterMs || 0))),
    uploadMs: Math.max(0, Math.min(60_000, Number(body.uploadMs || 0))),
  };
  const errors = {};

  if (values.targetRole.length < 2) errors.targetRole = "Enter a target role.";
  if (!EXPERIENCE_LEVELS.has(values.experienceLevel)) {
    errors.experienceLevel = "Choose a valid experience level.";
  }
  if (!INTERVIEW_TYPES.has(values.interviewType)) {
    errors.interviewType = "Choose a valid interview type.";
  }
  if (values.startRequestId.length < 8) {
    errors.startRequestId = "A valid interview start request is required.";
  }
  if (!values.audioReady) {
    errors.audioReady = "Complete the microphone readiness check before starting.";
  }
  if (!values.networkReady) {
    errors.networkReady = "Complete the connection readiness check before starting.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values,
  };
};
