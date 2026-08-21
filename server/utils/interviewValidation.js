const EXPERIENCE_LEVELS = new Set(["fresher", "entry", "junior", "mid", "senior"]);
const INTERVIEW_TYPES = new Set(["behavioral", "technical", "coding", "mixed"]);

const cleanText = (value, maxLength) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const meaningfulTargetRole = (value) => {
  const role = cleanText(value, 100);
  const letters = Array.from(role.toLowerCase()).filter((char) => /\p{L}/u.test(char));

  if (role.length < 2 || letters.length < 2) return false;

  // Reject obvious placeholder/gibberish values such as "ggggggg" while
  // preserving short legitimate titles/acronyms such as QA, HR, SDE, C++ dev.
  const compactLetters = letters.join("");
  if (/(.)\1{3,}/u.test(compactLetters)) return false;
  if (letters.length >= 5 && new Set(letters).size < 3) return false;

  return true;
};

export const validateInterviewStartInput = (body = {}) => {
  const values = {
    targetRole: cleanText(body.targetRole, 100),
    experienceLevel: cleanText(body.experienceLevel, 30).toLowerCase(),
    interviewType: cleanText(body.interviewType, 30).toLowerCase(),
    startRequestId: cleanText(body.startRequestId, 120),
    useLearnerProfile: String(body.useLearnerProfile ?? "true").toLowerCase() !== "false",
    audioReady: String(body.audioReady || "").toLowerCase() === "true",
    networkReady: String(body.networkReady || "").toLowerCase() === "true",
    averageLatencyMs: Math.max(0, Math.min(60_000, Number(body.averageLatencyMs || 0))),
    jitterMs: Math.max(0, Math.min(60_000, Number(body.jitterMs || 0))),
    uploadMs: Math.max(0, Math.min(60_000, Number(body.uploadMs || 0))),
  };
  const errors = {};

  if (!meaningfulTargetRole(values.targetRole)) errors.targetRole = "Enter a real target role, for example Web Developer, QA Engineer or Game Developer.";
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
