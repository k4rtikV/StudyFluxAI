import api from "./authService";

export const getFluxGemActivity = async (limit = 10) => {
  const response = await api.get("/fluxgems/activity", {
    params: { limit },
  });

  return response.data;
};
