📚 StudyFluxAI

AI-powered learning, study generation, tutoring, interviews, progression and productivity in one workspace.

MERN Stack · React 19 · Express 5 · MongoDB · Redis / Valkey · Socket.IO · Gemini AI · Google Forms · Razorpay · Brevo

Live App: https://studyfluxai.onrender.com
GitHub: https://github.com/k4rtikV/StudyFluxAI

The public deployment is a portfolio/test deployment on Render Free. The first request after inactivity can take longer while the service wakes up. Razorpay is configured in Test Mode, so no real payment is required for FluxGem checkout testing.

📌 About StudyFluxAI

StudyFluxAI is a full-stack AI learning platform built around the idea that study tools should work together instead of existing as isolated generators.

It combines AI notes and quizzes, persistent tutoring, study-session history, a voice-enabled Smart Interview system, study planning, progression, leaderboards, community activities, exports, notifications, admin controls and a virtual currency system called FluxGems.

The project goes beyond a basic MERN CRUD application by combining AI workloads, realtime updates, background jobs, rate limiting, caching, distributed locks, payment idempotency, OAuth integrations, timezone-aware progression and production-focused security in one application.

What StudyFluxAI focuses on

AI-assisted notes, quizzes and combined study sessions

Persistent AI Tutor conversations with usage accounting

Smart Interview sessions with voice, adaptive questioning and reports

Study Library history and recovery

Study Planner goals and reminders

XP, streaks, achievements and leaderboards

Community polls and Daily Challenges

FluxGem wallet, purchases and exactly-once payment crediting

Google Sign-In and Google Forms export

PDF exports for study content and interview reports

Realtime generation/session updates with Socket.IO

Redis-backed coordination, caching, locks and rate-limit support

Admin moderation, challenges, polls, announcements and user controls

Production security, health checks and deployment hardening

✨ Key Features

Area

Features

🧠 AI Study

AI Notes, AI Quiz and combined Study Sessions

📚 Study Library

Saved generations, quiz attempts, filters, history and recovery

💬 AI Tutor

Persistent conversations, daily free usage and FluxGem-paid continuation

🎙️ Smart Interview

Voice Q&A, adaptive questions, optional resume, TTS and detailed reports

🗓️ Study Planner

Goals, priorities, deadlines, rescheduling, completion and reminders

🏆 Progression

XP, streaks, achievements, milestones and rewards

🥇 Leaderboard

Overall, weekly and monthly XP/streak rankings

🌐 Community

Daily Challenges, community polls and participation rewards

💎 FluxGems

Wallet, rewards, AI usage costs and Razorpay Test Mode purchases

📤 Exports

Notes PDF, Google Forms quiz export and interview report PDF

🔔 Notifications

In-app notifications and transactional emails

🔐 Security

OTP, Google Sign-In, HttpOnly cookies, rate limits, session hardening and secure secrets

🛠️ Admin

Users, announcements, challenges, polls, leaderboard and platform controls

🧩 Feature Breakdown

🧠 AI Notes, Quiz & Study Sessions

StudyFluxAI can generate learning material from a user-selected topic or uploaded study source.

Generation modes

AI Notes — structured notes generated for the learner's topic/profile

AI Quiz — generated questions with answer checking and saved attempts

Study Session — notes and quiz content produced as one learning workflow

Generation safeguards

Server-side FluxGem charging

Bounded generation concurrency

Queue limits

Request rate limiting

Stale-generation recovery

Refund/recovery paths for interrupted generation

Persistent generation status in Study Library

Realtime status updates where available

Generated content can be reopened later from the Study Library instead of disappearing after navigation.

📚 Study Library

The Study Library acts as the persistent history for generated study content.

Users can:

Reopen Notes, Quizzes and Study Sessions

Search saved content

Filter by content type, status and source

Sort saved items

Resume/recover supported generation states

Review previous quiz attempts and results

Export supported content

Open Tutor-created quiz conversions

Study Library state is backed by MongoDB rather than browser-only state.

💬 AI Tutor

StudyFluxAI includes a persistent AI Tutor powered by Google Gemini.

Tutor conversations survive navigation and can use StudyFluxAI learning context to provide more relevant explanations.

Tutor capabilities

Persistent conversation history

Daily free-question allowance

FluxGem-paid questions after the free allowance

Rate limiting and daily hard limits

Bounded history/context sent to Gemini

Study-content context support

Tutor-to-quiz conversion

Durable usage accounting

Stale-request recovery

Tutor usage flow

Learner question
      ↓
Authenticated Tutor API
      ↓
Usage / allowance check
      ↓
Relevant StudyFluxAI context
      ↓
Gemini generation
      ↓
Persisted Tutor response
      ↓
Optional quiz conversion

🎙️ Smart Interview

Smart Interview is a voice-oriented interview practice system designed for more than a fixed list of questions.

Interview workflow

Audio preflight

Role and interview-type configuration

Optional resume upload

Optional coding-editor mode

Gemini-generated interview questions

TTS question playback

Spoken-answer capture

Silence-based answer submission

Adaptive follow-up questions

Early interview submission

Session recovery

Durable background report generation

Interview reports

Reports can include:

Role and interview type

Profile/resume snapshot

Questions and transcripts

Per-question scores

Per-question feedback

Delivery metrics

Overall score

Strengths

Improvement areas

Practice plan

Downloadable PDF report

Background report work uses Mongo-backed jobs/leases so interrupted processing can be recovered instead of depending only on in-memory execution.

🗓️ Study Planner

Study Planner helps learners organize upcoming work.

Plans can include:

Title

Target date/time

Estimated duration

Priority

Status

Users can create, edit, complete, delete and reschedule plans. The planner also supports reminder processing and deterministic local suggestions.

🏆 XP, Streaks & Progression

StudyFluxAI includes a progression system tied to learning activity.

Progression features

XP ledger

Learning streaks

Achievements

Quiz milestones

Daily Challenge rewards

Interview/progression rewards

FluxGem promotional/progression rewards

Timezone-aware daily activity rules

Timezone handling uses the learner's IANA timezone so daily streak and reward boundaries are not tied blindly to the server timezone.

🥇 Leaderboard

The leaderboard supports:

Overall ranking

Weekly ranking

Monthly ranking

XP ranking

Streak ranking

Top-three podium

Current-user highlight

Personal rank display

Leaderboard-related data can use Redis for faster shared state while persistent user/progression data remains in MongoDB.

🌐 Community & Daily Challenges

StudyFluxAI includes lightweight social learning features without turning the platform into a general-purpose social network.

Community features

Admin-created Daily Challenges

AI-assisted challenge generation for admins

Challenge answer/reward flow

Community polls

Poll voting and result display

Duplicate-vote/reward protections

Announcements

💎 FluxGems

FluxGems are StudyFluxAI's in-app learning currency.

They are used for selected AI actions such as:

AI Notes

AI Quizzes

Study Sessions

Paid Tutor questions after the free daily allowance

Smart Interview sessions

Wallet & payments

The wallet includes:

Current FluxGem balance

Reward credits

Debit/credit ledger

Purchase history

Razorpay checkout

Server-side payment verification

Razorpay webhook reconciliation

Duplicate webhook/callback protection

Transactional purchase receipts through Brevo

The deployed public demo uses Razorpay Test Mode.

Payment safety flow

Checkout request
      ↓
Server-defined package and amount
      ↓
Razorpay order
      ↓
Captured payment
      ↓
Signature / provider verification
      ↓
Idempotent purchase record
      ↓
Exactly-once FluxGem credit
      ↓
Webhook reconciliation + email receipt

Client-supplied prices are not trusted as the source of truth for wallet crediting.

📤 Google Forms & PDF Export

StudyFluxAI can move generated learning content outside the app.

Google Forms

Generated quizzes can be exported through Google OAuth to a Google Form/Quiz using the Google Forms API.

The integration uses a separate OAuth flow and encrypted stored Google credentials rather than exposing refresh tokens to the browser.

PDFs

Supported downloadable PDFs include:

AI Notes

Study content exports

Smart Interview reports

PDF generation is performed server-side with bounded request/resource handling.

🔐 Authentication & Security

StudyFluxAI uses a security-focused authentication and session design.

Local authentication flow

Email + Password
       ↓
Verification / OTP flow
       ↓
Verified user
       ↓
Signed authentication cookie
       ↓
Protected API access

Google Sign-In is also supported through Google Identity Services.

Security features

bcrypt password hashing

Email verification / OTP flows

Hashed verification codes

Forgot/reset password flow

Google Sign-In

HttpOnly authentication cookies

Secure cookies in production

SameSite cookie protection

Exact-origin CORS allowlisting

Browser Origin / Fetch-Metadata checks for unsafe requests

Helmet security headers

HSTS in production

Request body limits

Authentication rate limiting

Study-generation rate limiting

Interview rate limiting

Purchase rate limiting

Support-request rate limiting

Active-user / auth-version checks

Socket.IO authentication and room ownership checks

Production environment validation

Redacted/safe error logging at sensitive provider boundaries

Encrypted Google refresh-token storage

Razorpay webhook signature validation

Payment idempotency and replay protection

MongoDB ownership checks for user-scoped resources

Production readiness

StudyFluxAI exposes:

/api/health/live
/api/health/ready

Readiness checks verify MongoDB and, when required, Redis/Valkey before the service is considered healthy.

⚡ Realtime, Redis & Background Work

StudyFluxAI uses realtime and background coordination for workflows that cannot be treated as simple request/response CRUD.

Socket.IO

Socket.IO supports authenticated realtime updates for supported study/session workflows.

Redis / Valkey

Redis-compatible storage is used for selected capabilities such as:

Shared locks

Rate-limit support

Caching

Realtime/shared coordination

Leaderboard-related acceleration

MongoDB remains the persistent source of truth for durable application data.

Background work

Background workflows include:

Smart Interview report jobs

Study Planner reminders

Generation recovery

Workers use bounded polling, retry/attempt limits and lease-based recovery where appropriate.

🛠️ Admin Workspace

StudyFluxAI includes a separate admin experience for platform management.

Admin capabilities include:

Platform overview

User listing and details

User deactivation/reactivation

Daily Challenge management

AI-assisted Daily Challenge generation

Community Poll management

AI-assisted poll generation

Announcements

Leaderboard administration/viewing

Platform settings

Admin authorization is enforced by server middleware rather than only hiding frontend routes.

🧰 Tech Stack

Frontend

Technology

Purpose

React 19

User interface

Vite 8

Development and production builds

React Router 8

Client-side routing

Tailwind CSS 4

Styling and responsive UI

Axios

API requests

React Hook Form

Form management

Zod

Client-side validation

Socket.IO Client

Realtime communication

Lucide React

Icons

React Hot Toast

User feedback

Backend

Technology

Purpose

Node.js 22

JavaScript runtime

Express 5

REST API and production web server

MongoDB Atlas

Persistent application database

Mongoose 9

MongoDB ODM and schema/index definitions

Redis / Valkey

Locks, caching and shared coordination

Socket.IO

Realtime server communication

bcryptjs

Password hashing

JSON Web Token

Signed authentication state

Helmet

HTTP security headers

Multer

Bounded upload handling

PDFKit

PDF generation

Google Auth Library

Google identity verification

Google APIs

Google Forms OAuth/API integration

External Services

Service

Purpose

Google Gemini

Notes, quizzes, Tutor and Smart Interview AI workloads

Google Identity

Google Sign-In

Google Forms API

Quiz export

Brevo

Verification, security, reminder and payment emails

Razorpay

FluxGem checkout and payment webhooks

MongoDB Atlas

Managed MongoDB deployment

Render

Same-origin web deployment

Render Key Value / Valkey

Redis-compatible managed key-value service

🏗️ Architecture

StudyFluxAI is deployed as a same-origin full-stack application.

Browser
  │
  ├── React / Vite UI
  │
  └── HTTPS + Socket.IO
          │
          ▼
   Express / Node.js
          │
   ┌──────┼───────────────┬───────────────┐
   │      │               │               │
   ▼      ▼               ▼               ▼
MongoDB  Redis/Valkey   Gemini         External APIs
 Atlas                   AI            Google / Brevo /
                                      Razorpay

In production, Express serves the Vite client/dist build and /api from the same Render origin. This keeps browser authentication and cookie handling simpler than splitting the client and API across unrelated origins.

📁 Project Structure

StudyFluxAI/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   ├── generation/
│   │   │   ├── interview/
│   │   │   ├── progression/
│   │   │   ├── study/
│   │   │   └── tutor/
│   │   ├── context/
│   │   ├── data/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   └── admin/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── data/
│   ├── middleware/
│   ├── models/
│   ├── realtime/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── tests/
│   ├── utils/
│   ├── .env.example
│   ├── app.js
│   ├── index.js
│   └── package.json
│
├── .node-version
├── DEPLOYMENT.md
├── render.yaml
├── package.json
└── README.md

🚀 Getting Started

Prerequisites

Make sure you have:

Node.js 22.22.0

npm

Git

MongoDB database

Redis/Valkey for production-style shared coordination

Google Gemini API key

Brevo API key and verified sender

Google OAuth credentials

Razorpay credentials for payment testing

1. Clone the repository

git clone https://github.com/k4rtikV/StudyFluxAI.git
cd StudyFluxAI

2. Install dependencies

npm install
npm --prefix server install
npm --prefix client install

For deterministic CI/deployment installs, use npm ci with the committed lockfiles.

3. Configure environment variables

Use the provided examples:

server/.env.example
client/.env.example

Create your local environment files without committing real credentials.

Important backend configuration groups include:

# Core
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
REDIS_URL=redis://127.0.0.1:6379

# Authentication / security
JWT_SECRET=replace_with_a_long_random_secret
OTP_SECRET=replace_with_a_different_long_random_secret

# Email
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_sender

# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_FORMS_CLIENT_ID=your_forms_oauth_client_id
GOOGLE_FORMS_CLIENT_SECRET=your_forms_oauth_client_secret
GOOGLE_FORMS_REDIRECT_URI=http://localhost:5000/api/integrations/google-forms/callback
GOOGLE_OAUTH_STATE_SECRET=replace_with_a_random_secret
GOOGLE_TOKEN_ENCRYPTION_KEY=replace_with_a_random_secret

# AI
GEMINI_API_KEY=your_gemini_api_key

# Payments
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

Never commit real API keys, database credentials, OAuth client secrets, JWT/OTP secrets or webhook secrets.

4. Run StudyFluxAI

From the repository root:

npm run dev

Local services:

Frontend: http://localhost:5173
Backend:  http://localhost:5000

🧪 Available Scripts

Root

npm run dev
npm run server
npm run client
npm run build
npm start
npm test
npm run db:indexes

Client

npm --prefix client run dev
npm --prefix client run build
npm --prefix client run lint
npm --prefix client run preview

Server

npm --prefix server run dev
npm --prefix server start
npm --prefix server run test:auth
npm --prefix server run test:payment
npm --prefix server run test:phase3
npm --prefix server run test:phase4
npm --prefix server run db:indexes
npm --prefix server run seed:admin

✅ Testing

Useful verification before deployment:

npm ci --prefix server
npm ci --prefix client

npm --prefix server run test:phase4
npm --prefix client run lint
npm --prefix client run build

Check

Coverage

test:auth

Authentication and security regressions

test:payment

FluxGem purchase/payment security and idempotency

test:phase4

Authentication, payment and production-readiness checks

Client lint

Frontend static quality checks

Client build

Production Vite build

db:indexes

Declared MongoDB indexes and compatibility migration

Live provider behavior should still be smoke-tested after deployment because automated local tests cannot fully emulate Google, Gemini, Brevo, Razorpay, MongoDB Atlas, Render and realtime network behavior.

🌐 Production Deployment

StudyFluxAI is currently deployed at:

https://studyfluxai.onrender.com

The public deployment uses a single Render web service in Singapore with a same-origin React + Express architecture.

Production services

Render Free Web Service

MongoDB Atlas

Render Key Value / Valkey

Google Gemini

Google Identity

Google Forms API

Brevo

Razorpay Test Mode

Production endpoints

Live:      /api/health/live
Readiness: /api/health/ready
Forms:     /api/integrations/google-forms/callback
Razorpay:  /api/fluxgems/webhook

Free-tier note

Render Free services can spin down after inactivity. The first request after a sleep period may therefore take noticeably longer while the service starts again.

See DEPLOYMENT.md for deployment configuration, environment groups, security checks, health endpoints and production notes.

✅ Deployment Verification

The deployed application has already been validated against several live external integrations, including:

Render startup and readiness

MongoDB Atlas connectivity

Production MongoDB index creation

Redis/Valkey connectivity

Google Sign-In

Gemini quiz generation

Google Forms quiz export

Razorpay Test Mode checkout

Razorpay payment.captured webhook delivery

Razorpay order.paid webhook delivery

Exactly-once FluxGem wallet crediting

Purchase history

Brevo purchase receipt email

Admin account seeding

Additional feature-level smoke/regression testing can be performed continuously on the deployed application.

⚠️ Current Scope & Demo Notes

The public deployment is a portfolio/test deployment, not a commercial learning service.

Razorpay uses Test Mode; no real money should be accepted with the deployed test configuration.

AI-generated notes, quizzes, Tutor responses and interview feedback may contain mistakes and should be reviewed by the learner.

Render Free can cold-start after inactivity.

Redis/Valkey on the free tier is used as non-durable coordination/cache infrastructure; MongoDB remains the durable source of truth.

Smart Interview voice behavior depends on browser microphone/audio permissions and browser autoplay policies.

🔮 Possible Future Improvements

StudyFluxAI is already feature-rich for its current portfolio scope, but possible future extensions could include:

Paid hosting for always-on workers and lower cold-start latency

Dedicated durable job queue infrastructure

Broader automated end-to-end browser testing

Expanded observability and metrics dashboards

Additional learning-provider integrations

Collaborative/shared study spaces

More planner automation

More interview roles and assessment modes

Additional export destinations

Native/mobile client or PWA-focused offline workflows

👨‍💻 Author

Kartik Varma

GitHub: https://github.com/k4rtikV

StudyFluxAI was built as a portfolio-grade full-stack project focused on AI integration, realtime systems, background processing, security, payments, distributed coordination, data integrity and production readiness rather than only CRUD functionality.

📚 StudyFluxAI

Generate smarter. Study consistently. Learn with momentum.