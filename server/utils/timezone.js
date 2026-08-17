const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIME_ZONE = "UTC";

const formatterCache = new Map();

export const isValidTimeZone = (value) => {
  const candidate = String(value || "").trim();

  if (!candidate || candidate.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (
  value,
  fallback = DEFAULT_TIME_ZONE,
) => {
  const candidate = String(value || "").trim();
  return isValidTimeZone(candidate) ? candidate : fallback;
};

const getDateFormatter = (timeZone) => {
  const normalizedTimeZone = normalizeTimeZone(timeZone);

  if (!formatterCache.has(normalizedTimeZone)) {
    formatterCache.set(
      normalizedTimeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: normalizedTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  }

  return formatterCache.get(normalizedTimeZone);
};

export const toLocalDayNumber = (dateValue, timeZone) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getDateFormatter(timeZone).formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (["year", "month", "day"].includes(part.type)) {
      values[part.type] = Number(part.value);
    }
  }

  if (!values.year || !values.month || !values.day) {
    return null;
  }

  return Math.floor(
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
    ) / DAY_MS,
  );
};

export const getLocalTodayDayNumber = (
  timeZone,
  now = new Date(),
) => toLocalDayNumber(now, timeZone);

export { DEFAULT_TIME_ZONE };
