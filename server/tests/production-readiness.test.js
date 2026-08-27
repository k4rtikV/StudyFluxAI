import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getAllowedClientOrigins,
  isAllowedClientOrigin,
  validateRuntimeEnvironment,
} from "../config/env.js";
import { browserRequestGuard } from "../middleware/browserSecurity.js";
import { buildAuthRateLimitKeys } from "../utils/authRateLimitIdentity.js";
import {
  audioSignatureMatchesMimeType,
  hasPdfSignature,
} from "../utils/fileSignatures.js";
import { getSafeRequestTarget } from "../utils/requestLog.js";
import { redactSensitiveText } from "../utils/safeError.js";

const SNAPSHOT = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in SNAPSHOT)) delete process.env[key];
  }
  Object.assign(process.env, SNAPSHOT);
};

test.afterEach(restoreEnv);

test("client origin parsing rejects path-bearing and insecure production origins", () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://app.example.com,https://admin.example.com/path,http://evil.example.com";
  assert.deepEqual(getAllowedClientOrigins(), ["https://app.example.com"]);
  assert.equal(isAllowedClientOrigin("https://app.example.com"), true);
  assert.equal(isAllowedClientOrigin("https://evil.example.com"), false);
});

test("production validation rejects weak/reused authentication secrets", () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://studyflux.example";
  process.env.MONGO_URI = "mongodb+srv://example.invalid/db";
  process.env.JWT_SECRET = "same-secret-same-secret-same-secret-123";
  process.env.OTP_SECRET = process.env.JWT_SECRET;

  const { errors } = validateRuntimeEnvironment();
  assert.ok(errors.some((message) => message.includes("must be different")));
});

test("development keeps localhost as the safe default client origin", () => {
  process.env.NODE_ENV = "development";
  delete process.env.CLIENT_URL;
  assert.deepEqual(getAllowedClientOrigins(), ["http://localhost:5173"]);
});

test("request logging strips OAuth and other query values", () => {
  assert.equal(
    getSafeRequestTarget({
      originalUrl: "/api/integrations/google-forms/callback?code=secret&state=signed-state",
    }),
    "/api/integrations/google-forms/callback",
  );
});

test("invalid numeric configuration is rejected centrally", () => {
  process.env.STUDY_GENERATION_CONCURRENCY = "abc";
  process.env.INTERVIEW_JOB_CONCURRENCY = "1.5";

  const { errors } = validateRuntimeEnvironment();
  assert.ok(errors.some((message) => message.includes("STUDY_GENERATION_CONCURRENCY must be a finite number")));
  assert.ok(errors.some((message) => message.includes("INTERVIEW_JOB_CONCURRENCY must be an integer")));
});

test("login limiter identities independently bind IP and normalized account", () => {
  const first = buildAuthRateLimitKeys({
    bucket: "login",
    ip: "203.0.113.10",
    email: " Learner@Example.com ",
    accountLimit: 10,
  });
  const otherEmail = buildAuthRateLimitKeys({
    bucket: "login",
    ip: "203.0.113.10",
    email: "other@example.com",
    accountLimit: 10,
  });
  const otherIp = buildAuthRateLimitKeys({
    bucket: "login",
    ip: "203.0.113.11",
    email: "learner@example.com",
    accountLimit: 10,
  });

  assert.equal(first.primaryKey, otherEmail.primaryKey);
  assert.equal(first.accountKey, otherIp.accountKey);
  assert.notEqual(first.primaryKey, otherIp.primaryKey);
});

test("registration limiter independently binds IP and normalized account", () => {
  const first = buildAuthRateLimitKeys({
    bucket: "register",
    ip: "203.0.113.20",
    email: " NewLearner@Example.com ",
    accountLimit: 4,
  });
  const otherEmail = buildAuthRateLimitKeys({
    bucket: "register",
    ip: "203.0.113.20",
    email: "rotated@example.com",
    accountLimit: 4,
  });
  const otherIp = buildAuthRateLimitKeys({
    bucket: "register",
    ip: "203.0.113.21",
    email: "newlearner@example.com",
    accountLimit: 4,
  });

  assert.equal(first.primaryKey, otherEmail.primaryKey);
  assert.equal(first.accountKey, otherIp.accountKey);
  assert.notEqual(first.primaryKey, otherIp.primaryKey);
});

test("upload signatures distinguish real PDF and supported audio headers", () => {
  assert.equal(hasPdfSignature(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(hasPdfSignature(Buffer.from("not a pdf")), false);

  const wav = Buffer.alloc(12);
  wav.write("RIFF", 0, "ascii");
  wav.write("WAVE", 8, "ascii");
  assert.equal(audioSignatureMatchesMimeType(wav, "audio/wav"), true);
  assert.equal(audioSignatureMatchesMimeType(Buffer.from("fake"), "audio/wav"), false);
});

const makeResponse = () => {
  const response = { statusCode: 200, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (body) => { response.body = body; return response; };
  return response;
};

test("browser guard blocks cross-site unsafe requests before controller execution", () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://studyflux.example";

  const req = {
    method: "POST",
    get(name) {
      if (name.toLowerCase() === "sec-fetch-site") return "cross-site";
      if (name.toLowerCase() === "origin") return "https://evil.example";
      return "";
    },
  };
  const res = makeResponse();
  let called = false;
  browserRequestGuard(req, res, () => { called = true; });

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.code, "CROSS_SITE_REQUEST_BLOCKED");
});

test("browser guard allows configured same-origin unsafe requests", () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://studyflux.example";

  const req = {
    method: "PATCH",
    get(name) {
      if (name.toLowerCase() === "sec-fetch-site") return "same-origin";
      if (name.toLowerCase() === "origin") return "https://studyflux.example";
      return "";
    },
  };
  const res = makeResponse();
  let called = false;
  browserRequestGuard(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});



test("production validation rejects reused cross-purpose security secrets", () => {
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "jwt-secret-example-abcdefghijklmnopqrstuvwxyz-123456";
  process.env.OTP_SECRET = "otp-secret-example-abcdefghijklmnopqrstuvwxyz-654321";
  process.env.GOOGLE_OAUTH_STATE_SECRET = process.env.JWT_SECRET;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = process.env.JWT_SECRET;
  process.env.RAZORPAY_KEY_SECRET = "razorpay-shared-secret-example-abcdefghijklmnopqrstuvwxyz";
  process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_KEY_SECRET;

  const { errors } = validateRuntimeEnvironment();
  assert.ok(errors.some((message) => message.includes("JWT_SECRET and GOOGLE_OAUTH_STATE_SECRET")));
  assert.ok(errors.some((message) => message.includes("JWT_SECRET and GOOGLE_TOKEN_ENCRYPTION_KEY")));
  assert.ok(errors.some((message) => message.includes("RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET")));
});

test("Tutor stale failures cannot release a newer question's single-flight locks", () => {
  const source = fs.readFileSync(new URL("../services/tutorUsage.service.js", import.meta.url), "utf8");
  const start = source.indexOf("export const failTutorQuestion");
  const section = source.slice(start);
  const guard = section.indexOf("if (!failedMessage) return;");
  const conversationUnlock = section.indexOf("await TutorConversation.findOneAndUpdate");
  const usageUnlock = section.indexOf("await TutorDailyUsage.findOneAndUpdate");

  assert.ok(start >= 0);
  assert.ok(guard >= 0);
  assert.ok(guard < conversationUnlock);
  assert.ok(guard < usageUnlock);
});

test("Google Forms OAuth callback is bound to the active StudyFluxAI session", () => {
  const controller = fs.readFileSync(new URL("../controllers/studyExport.controller.js", import.meta.url), "utf8");
  const oauthService = fs.readFileSync(new URL("../services/googleForms.service.js", import.meta.url), "utf8");

  assert.match(controller, /oauthCallbackMatchesActiveSession/);
  assert.match(controller, /req\.cookies\?\.studyflux_token/);
  assert.match(controller, /verifyAuthToken\(token\)/);
  assert.match(oauthService, /algorithms: \["HS256"\]/);
});

test("legacy unverified cleanup cannot delete a Google-linked account", () => {
  const source = fs.readFileSync(new URL("../controllers/auth.controller.js", import.meta.url), "utf8");
  assert.match(source, /authProviders: \{ \$nin: \["google"\] \}/);
  assert.match(source, /user\.password = undefined/);
});

test("expensive export and admin AI routes have authenticated resource rate limits", () => {
  const studyRoutes = fs.readFileSync(new URL("../routes/studyExportRoutes.js", import.meta.url), "utf8");
  const formsRoutes = fs.readFileSync(new URL("../routes/googleFormsIntegrationRoutes.js", import.meta.url), "utf8");
  const interviewRoutes = fs.readFileSync(new URL("../routes/interviewRoutes.js", import.meta.url), "utf8");
  const adminRoutes = fs.readFileSync(new URL("../routes/adminRoutes.js", import.meta.url), "utf8");

  assert.match(studyRoutes, /bucket: "notes-pdf"/);
  assert.match(studyRoutes, /bucket: "google-forms-export"/);
  assert.match(formsRoutes, /bucket: "google-forms-connect"/);
  assert.match(interviewRoutes, /bucket: "report-pdf"/);
  assert.match(adminRoutes, /bucket: "admin-ai-draft"/);
});


test("quiz submissions derive progress from the transaction-local StudySession state", () => {
  const source = fs.readFileSync(new URL("../controllers/studySession.controller.js", import.meta.url), "utf8");
  const transactionStart = source.indexOf("await mongoSession.withTransaction(async () => {");
  const transactionSection = source.slice(transactionStart, source.indexOf("await mongoSession.endSession", transactionStart));

  assert.ok(transactionStart >= 0);
  assert.match(transactionSection, /const currentProgressSession = await StudySession\.findOne/);
  assert.match(transactionSection, /\.session\(mongoSession\)/);
  assert.match(transactionSection, /previousAttempts = Number\(currentProgressSession\.quizProgress/);
});

test("interview report finalization and job completion reject stale workers", () => {
  const reportSource = fs.readFileSync(new URL("../services/interviewReport.service.js", import.meta.url), "utf8");
  const jobSource = fs.readFileSync(new URL("../services/interviewJob.service.js", import.meta.url), "utf8");

  assert.match(reportSource, /"finalReport\.generatedAt": null/);
  assert.match(reportSource, /existingFinalized\?\.finalReport\?\.generatedAt/);
  assert.match(jobSource, /workerToken: job\.workerToken, status: "processing"/);
  assert.match(jobSource, /Number\(result\.modifiedCount \|\| 0\) === 1/);
  assert.match(jobSource, /if \(!completedByThisWorker\) return;/);
});


test("Smart Interview background retries remain bounded across polling and restart recovery", () => {
  const jobSource = fs.readFileSync(new URL("../services/interviewJob.service.js", import.meta.url), "utf8");
  const controllerSource = fs.readFileSync(new URL("../controllers/interview.controller.js", import.meta.url), "utf8");

  assert.doesNotMatch(jobSource, /if \(!force && \["failed"\]\.includes\(job\.status\)\)/);
  assert.match(jobSource, /\$ifNull: \["\$maxAttempts", DEFAULT_MAX_ATTEMPTS\]/);
  assert.match(jobSource, /INTERVIEW_JOB_ATTEMPTS_EXHAUSTED/);
  assert.match(controllerSource, /job\.status === "failed"/);
  assert.match(controllerSource, /INTERVIEW_REPORT_FAILED/);
  assert.match(controllerSource, /Use Retry report to start a fresh attempt/);
});


test("diagnostic error text redacts common credential and OAuth secret shapes", () => {
  const redacted = redactSensitiveText(
    "callback?code=oauth-code&state=signed-state Authorization: Bearer abc.def credential=google-id-token refresh_token=refresh-secret redis=rediss://default:redis-password@cache.example:6379 mongo=mongodb+srv://app-user:mongo-password@cluster.example/db",
  );

  assert.doesNotMatch(redacted, /oauth-code|signed-state|abc\.def|google-id-token|refresh-secret|redis-password|mongo-password/);
  assert.match(redacted, /\[REDACTED\]/);
});


test("authentication provider failures use redacted structured diagnostics", () => {
  const source = fs.readFileSync(new URL("../controllers/auth.controller.js", import.meta.url), "utf8");

  assert.match(source, /Google credential verification failed:", safeErrorDetails\(error\)/);
  assert.match(source, /Password-reset security email failed:", safeErrorDetails\(error\)/);
  assert.doesNotMatch(source, /Google credential verification failed:", error\.message/);
  assert.match(source, /Verification email delivery failed:", safeErrorDetails\(emailError\)/);
  assert.match(source, /Verification email resend failed:", safeErrorDetails\(emailError\)/);
  assert.match(source, /Password reset email delivery failed:", safeErrorDetails\(emailError\)/);
});

test("support rate-limit fallback has a hard cardinality cap", () => {
  const source = fs.readFileSync(new URL("../middleware/supportRateLimit.js", import.meta.url), "utf8");
  assert.match(source, /while \(fallbackBuckets\.size > 2500\)/);
});

test("complete production environment passes readiness validation", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    CLIENT_URL: "https://studyflux.example",
    MONGO_URI: "mongodb+srv://app-user:example-password@cluster.example/db",
    REDIS_URL: "rediss://default:example-password@redis.example:6379",
    REDIS_REQUIRED: "true",
    JWT_SECRET: "jwt-secret-example-abcdefghijklmnopqrstuvwxyz-123456",
    OTP_SECRET: "otp-secret-example-abcdefghijklmnopqrstuvwxyz-654321",
    BREVO_API_KEY: "xkeysib-production-example-value-1234567890",
    BREVO_SENDER_EMAIL: "mail@studyflux.example",
    GOOGLE_CLIENT_ID: "1234567890-example.apps.googleusercontent.com",
    GEMINI_API_KEY: "gemini-example-key-abcdefghijklmnopqrstuvwxyz",
    RAZORPAY_KEY_ID: "rzp_live_example123",
    RAZORPAY_KEY_SECRET: "razorpay-secret-example-abcdefghijklmnopqrstuvwxyz",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret-example-abcdefghijklmnopqrstuvwxyz",
    GOOGLE_FORMS_CLIENT_ID: "forms-client-example.apps.googleusercontent.com",
    GOOGLE_FORMS_CLIENT_SECRET: "forms-secret-example-abcdefghijklmnopqrstuvwxyz",
    GOOGLE_FORMS_REDIRECT_URI: "https://studyflux.example/api/integrations/google-forms/callback",
    GOOGLE_TOKEN_ENCRYPTION_KEY: "token-encryption-example-abcdefghijklmnopqrstuvwxyz",
    GOOGLE_OAUTH_STATE_SECRET: "oauth-state-example-abcdefghijklmnopqrstuvwxyz",
    ADMIN_SEED_EMAIL: "admin@studyflux.example",
    TRUST_PROXY: "1",
  });

  const { errors } = validateRuntimeEnvironment();
  assert.deepEqual(errors, []);
});