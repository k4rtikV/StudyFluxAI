import { safeErrorDetails } from "../utils/safeError.js";
import InterviewSession from "../models/InterviewSession.js";
import { enqueueInterviewReportJob } from "./interviewJob.service.js";
import { generateFinalInterviewReport } from "./interviewGemini.service.js";

const reportFlights = new Map();

const singleFlight = (key, operation) => {
  if (reportFlights.has(key)) return reportFlights.get(key);
  const promise = Promise.resolve()
    .then(operation)
    .finally(() => reportFlights.delete(key));
  reportFlights.set(key, promise);
  return promise;
};

const average = (values = [], digits = 0) => {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  const value = clean.reduce((sum, item) => sum + item, 0) / clean.length;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const cleanTextItems = (items = [], limit = 5) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))]
    .slice(0, limit);

const wordCount = (value) =>
  String(value || "").trim().split(/\s+/).filter(Boolean).length;

export const calculateInterviewReportMetrics = (interview) => {
  const turns = Array.isArray(interview?.transcript) ? interview.transcript : [];
  const answered = turns.filter(
    (turn) => turn?.completionReason !== "no_speech" && String(turn?.answerTranscript || "").trim(),
  );
  const noResponses = turns.filter((turn) => turn?.completionReason === "no_speech");
  const evaluations = turns.map((turn) => turn?.evaluation || {});

  const categoryMap = new Map();
  for (const turn of turns) {
    const category = String(turn?.question?.category || "General").trim() || "General";
    const current = categoryMap.get(category) || [];
    current.push(Number(turn?.evaluation?.score || 0));
    categoryMap.set(category, current);
  }

  return {
    overallScore: Math.round(average(evaluations.map((item) => item.score))),
    rubric: {
      relevance: average(evaluations.map((item) => item.relevance), 1),
      correctness: average(evaluations.map((item) => item.correctness), 1),
      clarity: average(evaluations.map((item) => item.clarity), 1),
      completeness: average(evaluations.map((item) => item.completeness), 1),
    },
    totalQuestions: turns.length,
    answeredQuestions: answered.length,
    noResponseCount: noResponses.length,
    responseRatePercent: turns.length ? Math.round((answered.length / turns.length) * 100) : 0,
    averageAnswerSeconds: Math.round(
      average(answered.map((turn) => Number(turn?.answerDurationMs || 0) / 1000)),
    ),
    estimatedAverageWpm: (() => {
      const totalWords = answered.reduce((sum, turn) => sum + wordCount(turn?.answerTranscript), 0);
      const totalMinutes = answered.reduce(
        (sum, turn) => sum + Math.max(Number(turn?.answerDurationMs || 0), 0) / 60000,
        0,
      );
      return totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0;
    })(),
    categoryScores: [...categoryMap.entries()].map(([category, scores]) => ({
      category,
      score: Math.round(average(scores)),
      questions: scores.length,
    })),
  };
};

const deterministicNarrative = (interview, metrics) => {
  const turns = Array.isArray(interview?.transcript) ? interview.transcript : [];
  const strengths = cleanTextItems(turns.flatMap((turn) => turn?.evaluation?.strengths || []), 4);
  const improvements = cleanTextItems(turns.flatMap((turn) => turn?.evaluation?.improvements || []), 4);
  const band = metrics.overallScore >= 75
    ? "strong"
    : metrics.overallScore >= 50
      ? "developing"
      : "needs_practice";

  return {
    headline:
      band === "strong"
        ? `Strong practice performance for ${interview.targetRole}`
        : band === "developing"
          ? `Developing interview readiness for ${interview.targetRole}`
          : `More focused practice recommended for ${interview.targetRole}`,
    summary: `You completed ${metrics.totalQuestions} questions with an overall practice score of ${metrics.overallScore}/100 and a ${metrics.responseRatePercent}% response rate. This report is based on the saved question-by-question evaluations from your mock interview.`,
    readinessBand: band,
    strengths: (strengths.length ? strengths : ["You completed the full adaptive interview flow."]).map((detail, index) => ({
      title: `Strength ${index + 1}`,
      detail,
    })),
    improvements: (improvements.length ? improvements : ["Review the question-by-question feedback and practice giving more specific, complete answers."]).map((detail, index) => ({
      title: `Improvement ${index + 1}`,
      detail,
    })),
    practicePlan: [
      {
        priority: "high",
        focus: "Weakest interview answers",
        action: "Re-answer the two lowest-scoring questions using the detailed feedback, then compare the revised answer with the original transcript.",
      },
      {
        priority: "medium",
        focus: "Specificity and completeness",
        action: "Practice concise answers that include a concrete example, reasoning or trade-off instead of stopping at definitions.",
      },
      {
        priority: "low",
        focus: "Role-focused repetition",
        action: `Run another ${interview.targetRole} mock interview after reviewing this report and compare the question-level scores.`,
      },
    ],
    closingNote: "Treat this score as practice feedback, not a hiring prediction. Use the question-level evidence to decide what to rehearse next.",
  };
};

export const ensureSmartInterviewReport = async ({ userId, interviewId }) =>
  singleFlight(`${userId}:${interviewId}`, async () => {
    let interview = await InterviewSession.findOne({ _id: interviewId, user: userId });
    if (!interview) {
      const error = new Error("Interview not found.");
      error.code = "INTERVIEW_NOT_FOUND";
      error.status = 404;
      throw error;
    }
    if (interview.status !== "completed") {
      const error = new Error("Complete the interview before opening its report.");
      error.code = "INTERVIEW_REPORT_NOT_AVAILABLE";
      error.status = 409;
      throw error;
    }
    if (interview.finalReport?.generatedAt) return interview;

    const metrics = calculateInterviewReportMetrics(interview);
    let narrative;
    let generation;

    const deterministic = deterministicNarrative(interview, metrics);

    try {
      const generated = await generateFinalInterviewReport({ interview, metrics });
      narrative = {
        ...deterministic,
        ...generated.narrative,
        // Keep the readiness band tied to StudyFluxAI's deterministic score thresholds.
        readinessBand: deterministic.readinessBand,
        strengths: generated.narrative?.strengths?.length
          ? generated.narrative.strengths
          : deterministic.strengths,
        improvements: generated.narrative?.improvements?.length
          ? generated.narrative.improvements
          : deterministic.improvements,
        practicePlan: generated.narrative?.practicePlan?.length
          ? generated.narrative.practicePlan
          : deterministic.practicePlan,
      };
      generation = {
        mode: "gemini",
        model: generated.model,
        usedFallback: Boolean(generated.usedFallback),
      };
    } catch (error) {
      console.error("Smart Interview final report Gemini synthesis failed; using saved-evaluation fallback:", safeErrorDetails(error));
      narrative = deterministic;
      generation = {
        mode: "saved_evaluation_fallback",
        model: "",
        usedFallback: true,
      };
    }

    const generatedAt = new Date();
    const finalReport = {
      version: "report-v1",
      ...metrics,
      ...narrative,
      generation,
      generatedAt,
      disclaimer:
        "This is AI-assisted mock-interview practice feedback, not a hiring decision, diagnosis, or prediction of job performance.",
    };

    const finalized = await InterviewSession.findOneAndUpdate(
      {
        _id: interviewId,
        user: userId,
        status: "completed",
        $or: [
          { "finalReport.generatedAt": null },
          { "finalReport.generatedAt": { $exists: false } },
        ],
      },
      {
        $set: {
          finalReport,
          phase: "report_ready",
          lastActivityAt: generatedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (finalized) return finalized;

    // Another valid worker may have won the finalization race while this one
    // was synthesizing. Return the authoritative persisted report instead of
    // overwriting it with a stale duplicate result.
    const existingFinalized = await InterviewSession.findOne({
      _id: interviewId,
      user: userId,
      status: "completed",
    });
    if (existingFinalized?.finalReport?.generatedAt) return existingFinalized;

    throw new Error("The Smart Interview report could not be finalized safely.");
  });

export const queueSmartInterviewReport = ({ userId, interviewId, force = false }) =>
  enqueueInterviewReportJob({ userId, interviewId, force }).catch((error) => {
    console.error("Smart Interview report job could not be queued:", safeErrorDetails(error));
    return null;
  });
