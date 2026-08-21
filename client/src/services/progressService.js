import api from "./authService";

let cachedResponse = null;
let cachedAt = 0;
let inFlight = null;

export const invalidateProgressOverviewCache = () => {
  cachedResponse = null;
  cachedAt = 0;
};

export const getProgressOverview = async ({
  force = false,
  maxAgeMs = 5000,
} = {}) => {
  const now = Date.now();

  if (
    !force &&
    cachedResponse &&
    now - cachedAt <= Math.max(Number(maxAgeMs) || 0, 0)
  ) {
    return cachedResponse;
  }

  if (!force && inFlight) return inFlight;

  const request = api
    .get("/progress/overview")
    .then((response) => {
      cachedResponse = response.data;
      cachedAt = Date.now();
      return response.data;
    })
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });

  inFlight = request;
  return request;
};
