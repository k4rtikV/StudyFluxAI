import api from "./authService";

export const getLearningProfile = async () => {
  const response = await api.get("/learning-profile");
  return response.data;
};

export const saveLearningProfile = async (payload) => {
  const response = await api.put("/learning-profile", payload);
  return response.data;
};