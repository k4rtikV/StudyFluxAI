import api from "./authService";

export const getTutorUsage = async () => {
  const response = await api.get("/tutor/usage");
  return response.data;
};

export const listTutorConversations = async (limit = 40) => {
  const response = await api.get("/tutor/conversations", {
    params: { limit },
  });

  return response.data;
};

export const createTutorConversation = async ({
  studySessionId = "",
} = {}) => {
  const response = await api.post("/tutor/conversations", {
    studySessionId,
  });

  return response.data;
};

export const getTutorConversation = async (conversationId) => {
  const response = await api.get(
    `/tutor/conversations/${conversationId}`,
  );

  return response.data;
};

export const archiveTutorConversation = async (conversationId) => {
  const response = await api.delete(
    `/tutor/conversations/${conversationId}`,
  );

  return response.data;
};

export const sendTutorMessage = async (
  conversationId,
  message,
) => {
  const response = await api.post(
    `/tutor/conversations/${conversationId}/messages`,
    { message },
  );

  return response.data;
};


export const convertTutorQuizToStudyLibrary = async (
  conversationId,
  assistantMessageId,
) => {
  const response = await api.post(
    `/tutor/conversations/${conversationId}/quiz-conversions`,
    { assistantMessageId },
  );

  return response.data;
};
