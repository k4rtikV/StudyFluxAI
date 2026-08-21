import { randomUUID } from "node:crypto";

import InterviewJob from "../models/InterviewJob.js";

const POLL_MS = Math.max(Number(process.env.INTERVIEW_JOB_POLL_MS || 1500), 500);
const LEASE_MS = Math.max(Number(process.env.INTERVIEW_JOB_LEASE_MS || 3 * 60 * 1000), 60000);
const CONCURRENCY = Math.max(Number(process.env.INTERVIEW_JOB_CONCURRENCY || 2), 1);
const DEFAULT_MAX_ATTEMPTS = Math.max(Number(process.env.INTERVIEW_JOB_MAX_ATTEMPTS || 3), 1);

let timer = null;
let active = 0;
let stopping = false;

const retryDelayMs = (attempts) => Math.min(5000 * Math.max(1, attempts), 30000);

const enqueue = async ({
  userId,
  interviewId,
  type,
  conversationId = null,
  userMessageId = null,
  force = false,
}) => {
  const now = new Date();
  const update = {
    $setOnInsert: {
      user: userId,
      interview: interviewId,
      type,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    },
    $set: {
      ...(conversationId ? { conversation: conversationId } : {}),
      ...(userMessageId ? { userMessage: userMessageId } : {}),
      ...(force
        ? {
            status: "queued",
            runAfter: now,
            leaseUntil: null,
            workerToken: "",
            completedAt: null,
            lastErrorCode: "",
            lastErrorMessage: "",
            attempts: 0,
          }
        : {}),
    },
  };

  let job = await InterviewJob.findOneAndUpdate(
    { interview: interviewId, type },
    update,
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  if (!force && ["failed"].includes(job.status)) {
    job = await InterviewJob.findOneAndUpdate(
      { _id: job._id, status: "failed" },
      {
        $set: {
          status: "queued",
          runAfter: now,
          leaseUntil: null,
          workerToken: "",
          completedAt: null,
          lastErrorCode: "",
          lastErrorMessage: "",
          attempts: 0,
        },
      },
      { returnDocument: "after" },
    ) || job;
  }

  scheduleSoon();
  return job;
};

export const enqueueInterviewReportJob = ({ userId, interviewId, force = false }) =>
  enqueue({ userId, interviewId, type: "report", force });

export const enqueueInterviewTutorJob = ({
  userId,
  interviewId,
  conversationId,
  userMessageId,
  force = false,
}) =>
  enqueue({
    userId,
    interviewId,
    type: "tutor_analysis",
    conversationId,
    userMessageId,
    force,
  });

export const getInterviewJob = ({ interviewId, type }) =>
  InterviewJob.findOne({ interview: interviewId, type }).lean();

const claimJob = async () => {
  const now = new Date();
  const token = randomUUID();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  return InterviewJob.findOneAndUpdate(
    {
      $and: [
        { runAfter: { $lte: now } },
        {
          $or: [
            { status: "queued" },
            { status: "processing", leaseUntil: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "processing",
        workerToken: token,
        leaseUntil,
        lastErrorCode: "",
        lastErrorMessage: "",
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { runAfter: 1, createdAt: 1 } },
  ).lean();
};

const completeJob = async (job) => {
  await InterviewJob.updateOne(
    { _id: job._id, workerToken: job.workerToken, status: "processing" },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        leaseUntil: null,
        workerToken: "",
        lastErrorCode: "",
        lastErrorMessage: "",
      },
    },
  );
};

const failOrRetryJob = async (job, error) => {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.maxAttempts || DEFAULT_MAX_ATTEMPTS);
  const terminal = attempts >= maxAttempts || error?.nonRetryable === true;

  await InterviewJob.updateOne(
    { _id: job._id, workerToken: job.workerToken, status: "processing" },
    {
      $set: {
        status: terminal ? "failed" : "queued",
        runAfter: terminal
          ? new Date()
          : new Date(Date.now() + retryDelayMs(attempts)),
        leaseUntil: null,
        workerToken: "",
        lastErrorCode: String(error?.code || "INTERVIEW_BACKGROUND_JOB_FAILED").slice(0, 120),
        lastErrorMessage: String(error?.message || "Interview background job failed.").slice(0, 500),
      },
    },
  );
};

const runJob = async (job) => {
  if (job.type === "report") {
    const { ensureSmartInterviewReport } = await import("./interviewReport.service.js");
    await ensureSmartInterviewReport({ userId: job.user, interviewId: job.interview });
    return;
  }

  if (job.type === "tutor_analysis") {
    const { runPersistedInterviewTutorAnalysis } = await import("./interviewTutorAnalysis.service.js");
    await runPersistedInterviewTutorAnalysis({
      userId: job.user,
      interviewId: job.interview,
      conversationId: job.conversation,
      userMessageId: job.userMessage,
    });
    return;
  }

  const error = new Error(`Unsupported interview job type: ${job.type}`);
  error.code = "INTERVIEW_JOB_TYPE_UNSUPPORTED";
  error.nonRetryable = true;
  throw error;
};

const processClaimedJob = async (job) => {
  const heartbeatMs = Math.max(Math.floor(LEASE_MS / 3), 15000);
  const heartbeat = setInterval(() => {
    InterviewJob.updateOne(
      { _id: job._id, workerToken: job.workerToken, status: "processing" },
      { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } },
    ).catch((error) => console.warn("Smart Interview job lease heartbeat failed:", error?.message || error));
  }, heartbeatMs);
  heartbeat.unref?.();

  try {
    await runJob(job);
    await completeJob(job);
  } catch (error) {
    console.error(`Interview background job ${job.type} failed:`, error?.message || error);
    await failOrRetryJob(job, error);
  } finally {
    clearInterval(heartbeat);
  }
};

const drain = async () => {
  if (stopping) return;

  while (active < CONCURRENCY) {
    const job = await claimJob();
    if (!job) break;
    active += 1;
    processClaimedJob(job)
      .catch((error) => console.error("Interview job worker failure:", error))
      .finally(() => {
        active -= 1;
        scheduleSoon();
      });
  }
};

const scheduleSoon = () => {
  if (stopping || timer) return;
  timer = setTimeout(async () => {
    timer = null;
    try {
      await drain();
    } catch (error) {
      console.error(
        "Smart Interview job worker poll failed; retrying on the next sweep:",
        error?.message || error,
      );
    } finally {
      if (!stopping) scheduleSoon();
    }
  }, POLL_MS);
  timer.unref?.();
};

export const recoverInterviewJobs = async () => {
  const now = new Date();
  const result = await InterviewJob.updateMany(
    { status: "processing", leaseUntil: { $lte: now } },
    {
      $set: {
        status: "queued",
        runAfter: now,
        leaseUntil: null,
        workerToken: "",
      },
    },
  );
  return Number(result.modifiedCount || 0);
};

export const startInterviewJobWorker = async () => {
  stopping = false;
  const recovered = await recoverInterviewJobs();
  if (recovered > 0) {
    console.warn(`Recovered ${recovered} interrupted Smart Interview background job(s).`);
  }
  scheduleSoon();
};

export const stopInterviewJobWorker = () => {
  stopping = true;
  if (timer) clearTimeout(timer);
  timer = null;
};
