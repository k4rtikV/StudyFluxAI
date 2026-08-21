# StudyFluxAI Production Deployment

StudyFluxAI is prepared for a **single same-origin Node web service**: Vite builds `client/dist`, and Express serves that build alongside `/api` and Socket.IO. This avoids cross-site cookie complexity and keeps auth cookies host-only.

## Recommended deployment shape

- One Node web service running `server/index.js`
- MongoDB Atlas (or equivalent managed MongoDB)
- Redis / managed key-value service
- Brevo transactional email
- Google Identity + Google Forms OAuth
- Gemini API
- Razorpay

A `render.yaml` is included for Render. It explicitly uses the **Starter** web-service plan because the included `preDeployCommand` (used to ensure MongoDB indexes before each release) is a paid-service feature. Secret values are intentionally `sync: false` or generated; never commit them.

For a hobby/free preview deployment, do not apply the blueprint unchanged: remove the pre-deploy command, choose the Free instance type, and run `npm --prefix server run db:indexes` manually against the target database before deploying. Render documents Free instances as suitable for testing/hobby use rather than production.

## Runtime pin

The repository pins Node.js `22.16.0` in `.node-version`. Keep this aligned with local/CI testing when upgrading Node.

## Build / start

```bash
npm --prefix server ci --omit=dev
npm --prefix client ci --include=dev
npm --prefix client run build
npm --prefix server run db:indexes
npm --prefix server start
```

The production server fails fast if critical configuration is missing or uses obvious example placeholders.

## Required production URLs

Assume the deployed origin is `https://YOUR_APP_HOST`:

- `CLIENT_URL=https://YOUR_APP_HOST`
- Google Forms redirect URI: `https://YOUR_APP_HOST/api/integrations/google-forms/callback`
- Razorpay webhook URL: `https://YOUR_APP_HOST/api/fluxgems/webhook`
- Render/host health check: `/api/health/ready`

`VITE_API_ORIGIN` should remain blank for the recommended same-origin deployment.

## Required secret/config groups

### Core
- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `OTP_SECRET`
- `GOOGLE_OAUTH_STATE_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Keep the four cryptographic secrets independent. Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` without a credential migration invalidates already-encrypted Google Forms refresh tokens.

### Email
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- optional `SUPPORT_INBOX_EMAIL`

### Google
- `GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_ID` (same web client ID; this one is intentionally public in the browser build)
- `GOOGLE_FORMS_CLIENT_ID`
- `GOOGLE_FORMS_CLIENT_SECRET`
- `GOOGLE_FORMS_REDIRECT_URI`

### AI
- `GEMINI_API_KEY`

### Payments
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Use a unique webhook secret. A `rzp_test_...` key is appropriate only for a portfolio/test deployment; switch to live keys before accepting real money.

### Admin
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD` only when running the seed/update command

After configuration, run the admin seed script once using the production environment:

```bash
npm --prefix server run seed:admin
```

Do not expose the seeded password in logs, repository files, screenshots, or frontend variables.

## Production defaults

Recommended settings:

```env
NODE_ENV=production
SERVE_CLIENT_BUILD=true
TRUST_PROXY=1
MONGO_AUTO_INDEX=false
REDIS_REQUIRED=true
INTERVIEW_TIMING_LOGS=false
SHUTDOWN_GRACE_MS=45000
SLOW_REQUEST_LOG_MS=2000
```

`TRUST_PROXY=1` is appropriate for the intended one-proxy Render deployment. Re-evaluate it if the network topology changes.

## Database indexes

Production startup uses `MONGO_AUTO_INDEX=false` in the provided blueprint. Ensure schema indexes before a deploy:

```bash
npm --prefix server run db:indexes
```

This uses Mongoose `createIndexes()` and does not intentionally drop existing indexes.

## Health endpoints

- `/api/health/live` — process is alive
- `/api/health/ready` — Mongo is reachable and Redis is available when `REDIS_REQUIRED=true`

The readiness endpoint returns `503` when a required dependency is unavailable so a hosting platform does not route traffic to an unhealthy instance.

## Security deployment checks

Before public launch:

1. Confirm HTTPS is forced by the hosting platform.
2. Confirm `CLIENT_URL` is the exact production origin; do not use `*`.
3. Confirm auth cookie is `Secure`, `HttpOnly`, `SameSite=Lax` in production.
4. Confirm Google and Razorpay callback/webhook URLs use the production HTTPS origin.
5. Confirm Razorpay webhook signing secret is configured and test duplicate/replayed webhook delivery.
6. Confirm Redis is reachable and `/api/health/ready` is green.
7. Confirm MongoDB network access is restricted as tightly as the hosting setup permits and the DB user has only required privileges.
8. Confirm Brevo sender/domain authentication and support inbox delivery.
9. Confirm no `.env`, credentials, private keys, or service-account files are committed.
10. Run `npm --prefix server test` and the client production build.
11. Run `npm audit` for root/server/client from a networked development/CI machine and review all production-dependency findings before launch.
12. Smoke-test registration, Google login/linking, password reset, FluxGem purchase/reconciliation, generation/refund, Study Planner reminders, Smart Interview, Google Forms export, admin deactivation, and session revocation.

## Rollback / shutdown behavior

The server stops accepting new traffic on `SIGTERM`, stops polling workers, disconnects Socket.IO, gives active work a bounded grace period, then closes Redis and MongoDB. Durable Interview/reminder jobs recover through their Mongo leases. An interrupted in-memory study generation is detected by the stale-generation recovery path and refunded rather than being left permanently charged.
