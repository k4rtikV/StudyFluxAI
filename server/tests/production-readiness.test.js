import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedClientOrigins,
  isAllowedClientOrigin,
  validateRuntimeEnvironment,
} from "../config/env.js";
import { browserRequestGuard } from "../middleware/browserSecurity.js";

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
