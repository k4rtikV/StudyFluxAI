const COMPLETION_REASONS = new Set([
  "manual_submit",
  "silence_auto_submit",
  "max_duration",
  "no_speech",
]);

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

export const validateInterviewAnswerInput = (body = {}, hasAudio = false) => {
  const values = {
    questionId: cleanText(body.questionId, 120),
    submissionId: cleanText(body.submissionId, 120),
    completionReason: cleanText(body.completionReason, 40),
    durationMs: Math.max(0, Math.min(180000, Number(body.durationMs || 0))),
  };
  const errors = {};

  if (values.questionId.length < 8) errors.questionId = "A valid interview question is required.";
  if (values.submissionId.length < 8) errors.submissionId = "A valid answer submission is required.";
  if (!COMPLETION_REASONS.has(values.completionReason)) {
    errors.completionReason = "Choose a valid answer completion reason.";
  }
  if (values.completionReason !== "no_speech" && !hasAudio) {
    errors.answerAudio = "A spoken answer recording is required.";
  }
  if (values.completionReason === "no_speech" && hasAudio) {
    values.completionReason = "silence_auto_submit";
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
};
