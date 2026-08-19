import api from "./authService";

export const listStudyPlans = async (status = "") => {
  const response = await api.get("/study-planner", {
    params: status ? { status } : {},
  });
  return response.data;
};

export const getStudyPlannerSummary = async () => {
  const response = await api.get("/study-planner/summary");
  return response.data;
};

export const findStudyPlannerMatches = async (payload) => {
  const response = await api.post("/study-planner/matches", payload);
  return response.data;
};

export const createStudyPlan = async (payload) => {
  const response = await api.post("/study-planner", payload);
  return response.data;
};

export const updateStudyPlan = async (planId, payload) => {
  const response = await api.patch(`/study-planner/${planId}`, payload);
  return response.data;
};

export const deleteStudyPlan = async (planId) => {
  const response = await api.delete(`/study-planner/${planId}`);
  return response.data;
};
