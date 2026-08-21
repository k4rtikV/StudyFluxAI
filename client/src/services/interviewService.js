import api from "./authService";

const normalizeBlobApiError = async (error) => {
  const payload = error?.response?.data;
  if (!(payload instanceof Blob)) throw error;

  try {
    const text = await payload.text();
    const parsed = JSON.parse(text);
    const normalized = new Error(parsed?.message || error?.message || "Request failed.");
    normalized.code = parsed?.code || "";
    normalized.response = { ...error.response, data: parsed };
    throw normalized;
  } catch (parseError) {
    if (parseError?.response?.data && !(parseError.response.data instanceof Blob)) throw parseError;
    throw error;
  }
};

export const getInterviewEligibility = async () => {
  const response = await api.get("/interviews/eligibility");
  return response.data;
};

export const listInterviews = async () => {
  const response = await api.get("/interviews");
  return response.data;
};

export const getInterview = async (interviewId) => {
  const response = await api.get(`/interviews/${interviewId}`);
  return response.data;
};

export const initializeInterview = async (interviewId) => {
  const response = await api.post(`/interviews/${interviewId}/initialize`);
  return response.data;
};

export const getInterviewQuestionAudio = async (interviewId, questionId) => {
  try {
    const response = await api.get(`/interviews/${interviewId}/question-audio`, {
      params: { questionId },
      responseType: "blob",
    });
    return {
      blob: response.data,
      serverTtsMs: Math.max(0, Number(response.headers?.["x-interview-tts-ms"] || 0)),
      cacheStatus: response.headers?.["x-interview-audio-cache"] || "unknown",
      voice: response.headers?.["x-interview-voice"] || "",
    };
  } catch (error) {
    return normalizeBlobApiError(error);
  }
};

export const submitInterviewAnswer = async ({
  interviewId,
  questionId,
  submissionId,
  completionReason,
  durationMs,
  audioBlob,
}) => {
  const form = new FormData();
  form.append("questionId", questionId);
  form.append("submissionId", submissionId);
  form.append("completionReason", completionReason);
  form.append("durationMs", String(Math.max(0, Number(durationMs || 0))));
  if (audioBlob) form.append("answerAudio", audioBlob, "interview-answer.wav");

  const response = await api.post(`/interviews/${interviewId}/answer`, form);
  return response.data;
};

export const runInterviewNetworkPreflight = async () => {
  const samples = [];
  for (let index = 0; index < 4; index += 1) {
    const started = performance.now();
    await api.get(`/health?interviewProbe=${Date.now()}-${index}`);
    samples.push(performance.now() - started);
  }

  const probe = "x".repeat(32 * 1024);
  const uploadStarted = performance.now();
  const uploadResponse = await api.post("/interviews/preflight", { probe });
  const uploadMs = performance.now() - uploadStarted;

  const averageLatencyMs = samples.reduce((total, value) => total + value, 0) / samples.length;
  const jitterMs = samples.length > 1
    ? samples.slice(1).reduce((total, value, index) => total + Math.abs(value - samples[index]), 0) / (samples.length - 1)
    : 0;

  return {
    averageLatencyMs,
    jitterMs,
    uploadMs,
    uploadedBytes: Number(uploadResponse?.data?.data?.receivedBytes || 0),
  };
};

export const startInterview = async ({ setup, resume, readiness }) => {
  const form = new FormData();
  form.append("targetRole", setup.targetRole);
  form.append("experienceLevel", setup.experienceLevel);
  form.append("interviewType", setup.interviewType);
  form.append("useLearnerProfile", setup.useLearnerProfile === false ? "false" : "true");
  form.append("startRequestId", setup.startRequestId);
  form.append("audioReady", readiness?.audioReady ? "true" : "false");
  form.append("networkReady", readiness?.networkReady ? "true" : "false");
  form.append("averageLatencyMs", String(Math.max(0, Number(readiness?.metrics?.averageLatencyMs || 0))));
  form.append("jitterMs", String(Math.max(0, Number(readiness?.metrics?.jitterMs || 0))));
  form.append("uploadMs", String(Math.max(0, Number(readiness?.metrics?.uploadMs || 0))));
  if (resume) form.append("resume", resume);

  const response = await api.post("/interviews/start", form);
  return response.data;
};

export const getInterviewReport = async (interviewId) => {
  const response = await api.get(`/interviews/${interviewId}/report`, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 202,
  });
  return response.data;
};

export const retryInterviewReport = async (interviewId) => {
  const response = await api.post(`/interviews/${interviewId}/report/retry`);
  return response.data;
};

export const downloadInterviewReportPdf = async (interviewId) => {
  const response = await api.get(`/interviews/${interviewId}/report/pdf`, {
    responseType: "blob",
  });
  return {
    blob: response.data,
    contentDisposition: response.headers?.["content-disposition"] || "",
  };
};

export const getInterviewTutorAnalysisStatus = async (interviewId) => {
  const response = await api.get(`/interviews/${interviewId}/tutor-analysis`);
  return response.data;
};

export const exportInterviewQuestionsToTutor = async (interviewId) => {
  const response = await api.post(`/interviews/${interviewId}/tutor-analysis`, null, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 202,
  });
  return response.data;
};
