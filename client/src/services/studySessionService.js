import api from "./authService";

export const generateStudySession = async ({
  generationType = "combined",
  sourceMode,
  topic,
  sourceFile,
  detailLevel = "balanced",
  difficulty = "profile",
  quizSize = 10,
  academicContext = null,
}) => {
  const formData = new FormData();

  formData.append("generationType", generationType);
  formData.append("sourceMode", sourceMode);
  formData.append("topic", topic || "");
  formData.append("detailLevel", detailLevel);
  formData.append("difficulty", difficulty);
  formData.append("quizSize", String(quizSize));

  if (academicContext) {
    formData.append(
      "contextEducationLevel",
      academicContext.educationLevel || "",
    );
    formData.append(
      "contextInstitutionState",
      academicContext.institutionState || "",
    );
    formData.append(
      "contextInstitutionChoice",
      academicContext.institutionChoice || "",
    );
    formData.append(
      "contextCustomInstitutionName",
      academicContext.customInstitutionName || "",
    );
    formData.append(
      "contextProgramChoice",
      academicContext.programChoice || "",
    );
    formData.append(
      "contextCustomProgram",
      academicContext.customProgram || "",
    );
    formData.append(
      "contextStreamChoice",
      academicContext.streamChoice || "",
    );
    formData.append(
      "contextCustomStream",
      academicContext.customStream || "",
    );
  }

  if (sourceMode === "source" && sourceFile) {
    formData.append("sourceFile", sourceFile);
  }

  const response = await api.post(
    "/study-sessions/generate",
    formData,
  );

  return response.data;
};

export const listStudySessions = async (limit = 30, type = "") => {
  const response = await api.get("/study-sessions", {
    params: {
      limit,
      ...(type ? { type } : {}),
    },
  });

  return response.data;
};

export const getStudySession = async (sessionId) => {
  const response = await api.get(
    `/study-sessions/${sessionId}`,
  );

  return response.data;
};

export const submitStudyQuiz = async (
  sessionId,
  answers,
) => {
  const response = await api.post(
    `/study-sessions/${sessionId}/quiz`,
    { answers },
  );

  return response.data;
};
