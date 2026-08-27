const SENSITIVE_QUERY_VALUE = /([?&](?:code|state|token|access_token|refresh_token|id_token|credential|api_key|key|secret|signature|otp|password)=)[^&#\s]*/gi;
const SENSITIVE_KEY_VALUE = /\b(password|otp|token|access_token|refresh_token|id_token|credential|api[_-]?key|client_secret|webhook_secret|signature)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&]+)/gi;
const AUTHORIZATION_VALUE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const URI_USERINFO = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+)(?::[^\s/@]*)?@/gi;

export const redactSensitiveText = (value) =>
  String(value ?? "")
    .replace(SENSITIVE_QUERY_VALUE, "$1[REDACTED]")
    .replace(SENSITIVE_KEY_VALUE, (_match, key) => `${key}=[REDACTED]`)
    .replace(AUTHORIZATION_VALUE, (_match, scheme) => `${scheme} [REDACTED]`)
    .replace(URI_USERINFO, (_match, scheme, username) => `${scheme}${username}:[REDACTED]@`);

const clean = (value, max = 1000) =>
  redactSensitiveText(value).replace(/[\r\n\t]+/g, " ").slice(0, max);

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
