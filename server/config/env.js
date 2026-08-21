const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const normalize = (value) => String(value ?? "").trim();

const NUMERIC_ENV_RULES = Object.freeze({
  PORT: { min: 1, max: 65535, integer: true },
  HTTP_REQUEST_TIMEOUT_MS: { min: 30000, max: 600000, integer: true },
  HTTP_KEEP_ALIVE_TIMEOUT_MS: { min: 5000, max: 120000, integer: true },
  HTTP_HEADERS_TIMEOUT_MS: { min: 10000, max: 180000, integer: true },
  SHUTDOWN_GRACE_MS: { min: 5000, max: 120000, integer: true },
  SLOW_REQUEST_LOG_MS: { min: 0, max: 600000, integer: true },
  MONGO_SERVER_SELECTION_TIMEOUT_MS: { min: 1000, max: 120000, integer: true },
  PENDING_REGISTRATION_TTL_MINUTES: { min: 10, max: 1440, integer: true },
  JWT_COOKIE_DAYS: { min: 1, max: 365, integer: true },
  GEMINI_PRIMARY_TIMEOUT_MS: { min: 8000, max: 300000, integer: true },
  GEMINI_FALLBACK_TIMEOUT_MS: { min: 8000, max: 300000, integer: true },
  STUDY_GENERATION_CONCURRENCY: { min: 1, max: 32, integer: true },
  STUDY_GENERATION_STALE_MS: { min: 120000, max: 3600000, integer: true },
  STUDY_GENERATION_QUEUE_MAX: { min: 1, max: 1000, integer: true },
  STUDY_GENERATION_QUEUE_MAX_BYTES: { min: 10485760, max: 536870912, integer: true },
  STUDY_GENERATION_RATE_LIMIT_PER_HOUR: { min: 1, max: 1000, integer: true },
  GENERATION_FLUXGEM_COST: { min: 0, max: 1000000, integer: true },
  AI_NOTES_FLUXGEM_COST: { min: 0, max: 1000000, integer: true },
  AI_QUIZ_FLUXGEM_COST: { min: 0, max: 1000000, integer: true },
  TUTOR_FREE_QUESTIONS_PER_DAY: { min: 0, max: 10000, integer: true },
  TUTOR_PAID_QUESTION_COST: { min: 0, max: 1000000, integer: true },
  TUTOR_DAILY_HARD_LIMIT: { min: 1, max: 100000, integer: true },
  TUTOR_RATE_LIMIT_MS: { min: 0, max: 3600000, integer: true },
  TUTOR_STALE_LOCK_MS: { min: 30000, max: 3600000, integer: true },
  TUTOR_QUESTION_MAX_LENGTH: { min: 200, max: 50000, integer: true },
  TUTOR_HISTORY_MESSAGES: { min: 2, max: 30, integer: true },
  TUTOR_MAX_OUTPUT_TOKENS: { min: 512, max: 65536, integer: true },
  TUTOR_MAX_CONTINUATIONS: { min: 0, max: 4, integer: true },
  TUTOR_STUDY_CONTEXT_MAX_CHARS: { min: 4000, max: 500000, integer: true },
  TUTOR_QUIZ_CONVERSION_COST: { min: 1, max: 1000000, integer: true },
  TUTOR_QUIZ_CONVERSION_TIMEOUT_MS: { min: 8000, max: 300000, integer: true },
  RAZORPAY_REQUEST_TIMEOUT_MS: { min: 3000, max: 45000, integer: true },
  REDIS_CONNECT_TIMEOUT_MS: { min: 1000, max: 30000, integer: true },
  REDIS_RECONNECT_MS: { min: 5000, max: 300000, integer: true },
  INTERVIEW_FLUXGEM_COST: { min: 1, max: 1000000, integer: true },
  INTERVIEW_QUESTION_COUNT: { min: 3, max: 15, integer: true },
  INTERVIEW_NO_SPEECH_TIMEOUT_MS: { min: 5000, max: 45000, integer: true },
  INTERVIEW_END_SILENCE_MS: { min: 1200, max: 15000, integer: true },
  INTERVIEW_MAX_ANSWER_SECONDS: { min: 30, max: 300, integer: true },
  INTERVIEW_GEMINI_TIMEOUT_MS: { min: 8000, max: 300000, integer: true },
  INTERVIEW_TTS_TIMEOUT_MS: { min: 8000, max: 300000, integer: true },
  INTERVIEW_JOB_POLL_MS: { min: 500, max: 300000, integer: true },
  INTERVIEW_JOB_LEASE_MS: { min: 60000, max: 3600000, integer: true },
  INTERVIEW_JOB_CONCURRENCY: { min: 1, max: 32, integer: true },
  INTERVIEW_JOB_MAX_ATTEMPTS: { min: 1, max: 20, integer: true },
  STUDY_PLAN_REMINDER_POLL_MS: { min: 60000, max: 86400000, integer: true },
  STUDY_PLAN_REMINDER_LEASE_MS: { min: 60000, max: 86400000, integer: true },
  STUDY_PLAN_REMINDER_RETRY_MS: { min: 60000, max: 604800000, integer: true },
  STUDY_PLAN_REMINDER_MAX_ATTEMPTS: { min: 1, max: 100, integer: true },
  STUDY_PLAN_REMINDER_BATCH_SIZE: { min: 1, max: 50, integer: true },
});

export const isProduction = () => normalize(process.env.NODE_ENV).toLowerCase() === "production";

export const getBooleanEnv = (name, fallback = false) => {
  const raw = normalize(process.env[name]).toLowerCase();
  if (!raw) return fallback;
  if (TRUE_VALUES.has(raw)) return true;
  if (FALSE_VALUES.has(raw)) return false;
  return fallback;
};

export const getNumberEnv = (name, fallback, options = {}) => {
  const rule = NUMERIC_ENV_RULES[name] || {};
  const min = options.min ?? rule.min ?? -Infinity;
  const max = options.max ?? rule.max ?? Infinity;
  const raw = normalize(process.env[name]);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (rule.integer && !Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const validateNumericEnvironment = (errors) => {
  for (const [name, rule] of Object.entries(NUMERIC_ENV_RULES)) {
    const raw = normalize(process.env[name]);
    if (!raw) continue;

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors.push(`${name} must be a finite number.`);
      continue;
    }
    if (rule.integer && !Number.isInteger(value)) {
      errors.push(`${name} must be an integer.`);
    }
    if (value < rule.min || value > rule.max) {
      errors.push(`${name} must be between ${rule.min} and ${rule.max}.`);
    }
  }
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

  validateNumericEnvironment(errors);

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