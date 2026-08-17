export const emptyChallengeForm = () => ({
  question: "",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
  category: "General Knowledge",
  difficulty: "medium",
  explanation: "",
  xpReward: 20,
  fluxGemReward: 5,
  status: "draft",
  publishAt: "",
  expiresAt: "",
});

export const emptyPollForm = () => ({
  question: "",
  options: ["", ""],
  status: "draft",
  publishAt: "",
  expiresAt: "",
});

export const toAdminInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

export const toAdminApiPayload = (form) => ({
  ...form,
  publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
  expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
});

export const formatAdminDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not scheduled";
