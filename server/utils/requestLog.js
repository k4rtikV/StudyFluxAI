const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export const getSafeRequestTarget = (req) => {
  const raw = String(req?.originalUrl || req?.url || req?.path || "/");
  const pathOnly = raw.split(/[?#]/, 1)[0] || "/";
  return pathOnly.replace(CONTROL_CHARACTERS, "").slice(0, 2048) || "/";
};