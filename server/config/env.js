const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const normalize = (value) => String(value ?? "").trim();

export const isProduction = () => normalize(process.env.NODE_ENV).toLowerCase() === "production";

export const getBooleanEnv = (name, fallback = false) => {
  const raw = normalize(process.env[name]).toLowerCase();
  if (!raw) return fallback;
  if (TRUE_VALUES.has(raw)) return true;
  if (FALSE_VALUES.has(raw)) return false;
  return fallback;
};

export const getNumberEnv = (name, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const normalizeOrigin = (value, { allowHttpLocalhost = true } = {}) => {
  const raw = normalize(value).replace(/\/+$/, "");
  if (!raw) return "";

  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }

  if (!["http:", "https:"].includes(url.protocol)) return "";
  if (url.username || url.password || url.search || url.hash) return "";
  if (url.pathname && url.pathname !== "/") return "";

  const hostname = url.hostname.toLowerCase();
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (url.protocol !== "https:" && !(allowHttpLocalhost && local)) return "";

  return `${url.protocol}//${url.host}`;
};

export const getAllowedClientOrigins = () => {
  const configured = normalize(process.env.CLIENT_URL)
    .split(",")
    .map((entry) => normalizeOrigin(entry, { allowHttpLocalhost: !isProduction() }))
    .filter(Boolean);

  if (configured.length > 0) return [...new Set(configured)];
  return isProduction() ? [] : ["http://localhost:5173"];
};

export const getPrimaryClientUrl = () => getAllowedClientOrigins()[0] || "http://localhost:5173";

export const isAllowedClientOrigin = (origin) => {
  const normalized = normalizeOrigin(origin, { allowHttpLocalhost: !isProduction() });
  return Boolean(normalized) && getAllowedClientOrigins().includes(normalized);
};

export const getTrustProxySetting = () => {
  const raw = normalize(process.env.TRUST_PROXY);
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (TRUE_VALUES.has(raw.toLowerCase())) return 1;
  if (FALSE_VALUES.has(raw.toLowerCase())) return false;
  return raw;
};

const isPlaceholder = (value) => {
  const raw = normalize(value).toLowerCase();
  if (!raw) return true;
  return [
    "your_secret_here",
    "your_real_brevo_api_key",
    "your_verified_brevo_sender_email",
    "your_mongodb_connection_string",
    "your_random_secret",
    "your_razorpay_key_secret",
    "your_razorpay_webhook_secret",
    "your_strong_admin_password",
    "put_a_long_random_secret_here",
    "admin_email",
    "your_client_id_here",
    "your_new_client_id",
    "your_new_client_secret",
    "your_existing_fintrack_key",
  ].includes(raw);
};

const requireValue = (errors, name, { minLength = 1, email = false } = {}) => {
  const value = normalize(process.env[name]);
  if (!value || isPlaceholder(value)) {
    errors.push(`${name} is missing or still uses an example placeholder.`);
    return "";
  }
  if (value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters.`);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${name} must be a valid email address.`);
  }
  return value;
};

export const validateRuntimeEnvironment = () => {
  const errors = [];
  const warnings = [];
  const production = isProduction();

  requireValue(errors, "MONGO_URI");
  const jwtSecret = requireValue(errors, "JWT_SECRET", { minLength: production ? 32 : 16 });
  const otpSecret = requireValue(errors, "OTP_SECRET", { minLength: production ? 32 : 16 });

  if (jwtSecret && otpSecret && jwtSecret === otpSecret) {
    errors.push("JWT_SECRET and OTP_SECRET must be different secrets.");
  }

  if (production) {
    const origins = getAllowedClientOrigins();
    if (origins.length === 0) {
      errors.push("CLIENT_URL must contain at least one valid HTTPS origin in production.");
    }

    requireValue(errors, "BREVO_API_KEY", { minLength: 16 });
    requireValue(errors, "BREVO_SENDER_EMAIL", { email: true });
    requireValue(errors, "GOOGLE_CLIENT_ID", { minLength: 10 });
    requireValue(errors, "GEMINI_API_KEY", { minLength: 16 });
    requireValue(errors, "RAZORPAY_KEY_ID", { minLength: 8 });
    requireValue(errors, "RAZORPAY_KEY_SECRET", { minLength: 16 });
    requireValue(errors, "RAZORPAY_WEBHOOK_SECRET", { minLength: 16 });
    requireValue(errors, "GOOGLE_FORMS_CLIENT_ID", { minLength: 10 });
    requireValue(errors, "GOOGLE_FORMS_CLIENT_SECRET", { minLength: 12 });
    requireValue(errors, "GOOGLE_FORMS_REDIRECT_URI", { minLength: 12 });
    requireValue(errors, "GOOGLE_TOKEN_ENCRYPTION_KEY", { minLength: 32 });
    requireValue(errors, "GOOGLE_OAUTH_STATE_SECRET", { minLength: 32 });
    requireValue(errors, "ADMIN_SEED_EMAIL", { email: true });

    if (!normalize(process.env.REDIS_URL)) {
      if (getBooleanEnv("REDIS_REQUIRED", false)) {
        errors.push("REDIS_URL is required because REDIS_REQUIRED=true.");
      } else {
        warnings.push("REDIS_URL is not configured; rate limits/caches/locks fall back to process-local behavior.");
      }
    }

    if (!normalize(process.env.TRUST_PROXY)) {
      warnings.push("TRUST_PROXY is not configured; set it for the production reverse proxy so IP-based rate limits use the real client IP.");
    }

    if (normalize(process.env.RAZORPAY_KEY_ID).startsWith("rzp_test_")) {
      warnings.push("Razorpay is configured with a test key. Keep this only for a portfolio/test deployment; use live keys before accepting real money.");
    }
  }

  const formsRedirect = normalize(process.env.GOOGLE_FORMS_REDIRECT_URI);
  if (formsRedirect) {
    try {
      const url = new URL(formsRedirect);
      if (!url.pathname.endsWith("/api/integrations/google-forms/callback")) {
        warnings.push("GOOGLE_FORMS_REDIRECT_URI does not end with the expected callback path.");
      }
      if (production && url.protocol !== "https:") {
        errors.push("GOOGLE_FORMS_REDIRECT_URI must use HTTPS in production.");
      }
    } catch {
      errors.push("GOOGLE_FORMS_REDIRECT_URI must be a valid absolute URL.");
    }
  }

  return { errors, warnings };
};

export const assertRuntimeEnvironment = () => {
  const { errors, warnings } = validateRuntimeEnvironment();
  for (const warning of warnings) console.warn(`[config-warning] ${warning}`);
  if (errors.length > 0) {
    const error = new Error(`Invalid StudyFluxAI environment:\n- ${errors.join("\n- ")}`);
    error.code = "INVALID_RUNTIME_ENVIRONMENT";
    throw error;
  }
};
