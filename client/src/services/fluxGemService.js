import api from "./authService";

export const getFluxGemActivity = async (options = 10) => {
  const params =
    typeof options === "number"
      ? { limit: options }
      : {
          limit: options?.limit ?? 10,
          page: options?.page ?? 1,
          ...(options?.type ? { type: options.type } : {}),
          ...(options?.reason ? { reason: options.reason } : {}),
        };

  const response = await api.get("/fluxgems/activity", {
    params,
  });

  return response.data;
};

export const getFluxGemPurchases = async ({ limit = 20, page = 1 } = {}) =>
  getFluxGemActivity({
    limit,
    page,
    type: "purchase",
  });
