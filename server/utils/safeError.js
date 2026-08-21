const clean = (value, max = 1000) => String(value ?? "").replace(/[\r\n\t]+/g, " ").slice(0, max);

export const safeErrorDetails = (error) => {
  if (!error) return { message: "Unknown error" };

  const details = {
    name: clean(error.name || "Error", 120),
    message: clean(error.message || error, 1000),
  };

  if (error.code !== undefined && error.code !== null) {
    details.code = clean(error.code, 160);
  }

  if (process.env.NODE_ENV !== "production" && error.stack) {
    details.stack = clean(error.stack, 4000);
  }

  return details;
};
