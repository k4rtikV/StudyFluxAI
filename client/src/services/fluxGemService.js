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

export const createFluxGemPurchaseOrder = async (packageId) => {
  const response = await api.post("/fluxgems/purchases/order", {
    packageId,
  });

  return response.data;
};

export const verifyFluxGemPurchase = async (paymentResponse) => {
  const response = await api.post(
    "/fluxgems/purchases/verify",
    paymentResponse,
  );

  return response.data;
};

export const getFluxGemPurchaseStatus = async (purchaseId) => {
  const response = await api.get(`/fluxgems/purchases/${purchaseId}`);
  return response.data;
};
