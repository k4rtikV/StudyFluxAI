import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Gauge,
  History,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import LevelKite from "../components/progression/LevelKite";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  downloadInterviewReportPdf,
  exportInterviewQuestionsToTutor,
  getInterviewReport,
  getInterviewTutorAnalysisStatus,
  retryInterviewReport,
} from "../services/interviewService";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const pretty = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const scoreTone = (score) => {
  const value = Number(score || 0);
  if (value >= 75) return "text-emerald-700 border-emerald-200 bg-emerald-50/75";
  if (value >= 50) return "text-amber-700 border-amber-200 bg-amber-50/75";
  return "text-rose-700 border-rose-200 bg-rose-50/75";
};

const bandLabel = (band) => {
  if (band === "strong") return "Strong practice performance";
  if (band === "needs_practice") return "More practice recommended";
  return "Developing interview readiness";
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function MetricBar({ label, value, max = 10 }) {
  const safeValue = Math.max(0, Math.min(Number(value || 0), max));
  const percent = max > 0 ? (safeValue / max) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900">{safeValue.toFixed(1)} / {max}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#22d3ee,#7c3aed)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SmartInterviewReportPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [sendingToTutor, setSendingToTutor] = useState(false);
  const [tutorAnalysis, setTutorAnalysis] = useState({ status: "loading", conversationId: null, failure: null });
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadReport = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");

    try {
      const response = await getInterviewReport(interviewId);
      if (!mountedRef.current) return;
      if (response?.data?.ready) {
        setPayload(response.data);
        setGenerating(false);
        stopPolling();
        return;
      }

      setGenerating(true);
      setLoading(false);
      stopPolling();
      pollRef.current = window.setTimeout(() => {
        if (mountedRef.current) loadReport({ quiet: true });
      }, 2500);
    } catch (requestError) {
      if (!mountedRef.current) return;
      stopPolling();
      setGenerating(false);
      setError(errorMessage(requestError, "Your interview report could not be loaded."));
    } finally {
      if (mountedRef.current && !quiet) setLoading(false);
    }
  }, [interviewId, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    loadReport();
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [loadReport, stopPolling]);

  useEffect(() => {
    if (!payload?.report) return undefined;

    let active = true;
    let timer = null;

    const pollTutorStatus = async () => {
      try {
        const response = await getInterviewTutorAnalysisStatus(interviewId);
        if (!active) return;
        const data = response?.data || {};
        setTutorAnalysis({
          status: data.status || "not_started",
          conversationId: data.conversationId || null,
          failure: data.failure || null,
        });

        if (data.status === "generating") {
          timer = window.setTimeout(pollTutorStatus, 2200);
        }
      } catch {
        if (active) {
          setTutorAnalysis((current) => current.status === "loading" ? { status: "not_started", conversationId: null, failure: null } : current);
        }
      }
    };

    pollTutorStatus();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [interviewId, payload?.report?.generatedAt]);

  const retryReport = async () => {
    setError("");
    setGenerating(true);
    try {
      const response = await retryInterviewReport(interviewId);
      if (!mountedRef.current) return;
      if (response?.data?.ready) {
        setPayload(response.data);
        setGenerating(false);
      } else {
        loadReport({ quiet: true });
      }
    } catch (requestError) {
      setGenerating(false);
      setError(errorMessage(requestError, "Astra could not prepare the report yet."));
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const result = await downloadInterviewReportPdf(interviewId);
      const match = /filename="?([^";]+)"?/i.exec(result.contentDisposition || "");
      const filename = match?.[1] || "studyfluxai-smart-interview-report.pdf";
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Interview report PDF downloaded.");
    } catch (requestError) {
      toast.error(errorMessage(requestError, "The report PDF could not be downloaded."));
    } finally {
      setDownloading(false);
    }
  };

  const analyzeQuestionsInTutor = async () => {
    if (sendingToTutor) return;

    if (["generating", "ready"].includes(tutorAnalysis.status) && tutorAnalysis.conversationId) {
      navigate(`/ai-tutor?conversation=${tutorAnalysis.conversationId}&source=smart-interview`);
      return;
    }

    setSendingToTutor(true);

    try {
      const response = await exportInterviewQuestionsToTutor(interviewId);
      const data = response?.data || {};
      const conversationId = data.conversationId;
      const balance = Number(data.billing?.balance);
      const charged = Number(data.billing?.charged || 0);
      const status = data.status || "generating";

      if (Number.isFinite(balance)) {
        setUser((current) =>
          current
            ? { ...current, fluxGems: balance }
            : current,
        );
      }

      if (!conversationId) {
        throw new Error("AI Tutor conversation was not returned.");
      }

      setTutorAnalysis({ status, conversationId, failure: null });

      if (status === "ready") {
        toast.success("Opening your completed interview deep dive in AI Tutor.");
      } else if (charged > 0) {
        toast.success(`Question stack exported · Tutor is generating the brief · ${charged} FluxGems used.`);
      } else {
        toast.success("Question stack exported. Tutor is generating the deep dive now.");
      }

      navigate(`/ai-tutor?conversation=${conversationId}&source=smart-interview`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, "AI Tutor could not start this interview deep dive yet."));
    } finally {
      setSendingToTutor(false);
    }
  };

  const report = payload?.report || null;
  const interview = payload?.interview || null;
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const progressionReward = payload?.progressionReward || null;

  const categoryScores = useMemo(
    () => Array.isArray(report?.categoryScores) ? report.categoryScores : [],
    [report],
  );

  if (loading && !payload) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[58vh] items-center justify-center">
          <div className="rounded-3xl border border-violet-200 bg-white px-6 py-5 text-sm font-extrabold text-slate-600 shadow-sm">
            <LoaderCircle size={19} className="mr-2 inline animate-spin text-violet-600" /> Loading interview report...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if ((generating || !report) && !error) {
    return (
      <DashboardLayout>
        <button type="button" onClick={() => navigate("/interview")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 shadow-sm hover:text-violet-700">
          <ArrowLeft size={15} /> Interview history
        </button>
        <section className="mx-auto mt-8 max-w-3xl rounded-[32px] border border-violet-200 bg-[linear-gradient(145deg,rgba(245,243,255,0.92),rgba(255,255,255,0.96),rgba(236,254,255,0.84))] p-8 text-center shadow-[0_22px_70px_rgba(79,70,229,0.10)]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-violet-600 shadow-md ring-1 ring-violet-100">
            <BrainCircuit size={29} className="animate-pulse" />
          </div>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-700">Astra is reviewing your interview</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Preparing your final report.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            The numeric scores are calculated from the saved question evaluations first. Gemini then synthesizes those results into strengths, improvements and a practical study plan.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-extrabold text-violet-700">
            <LoaderCircle size={14} className="animate-spin" /> This page updates automatically
          </div>
        </section>
      </DashboardLayout>
    );
  }

  if (error && !payload) {
    return (
      <DashboardLayout>
        <div className="mx-auto mt-10 max-w-2xl rounded-[30px] border border-rose-200 bg-white p-7 text-center shadow-sm">
          <RefreshCcw size={28} className="mx-auto text-rose-500" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">Report generation needs another try.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={retryReport} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white"><RefreshCcw size={15} /> Retry report</button>
            <button type="button" onClick={() => navigate("/interview")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700">Interview history</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const overallScore = Number(report?.overallScore || 0);
  const rubric = report?.rubric || {};
  const xpEarned = Number(progressionReward?.xpEarned || 0);
  const levelUp = progressionReward?.levelUp || null;
  const tutorStatus = tutorAnalysis.status;
  const tutorButtonLabel = sendingToTutor
    ? "Starting Tutor deep dive..."
    : tutorStatus === "generating"
      ? "Open generation in Tutor"
      : tutorStatus === "ready"
        ? "Open deep dive in Tutor"
        : tutorStatus === "failed"
          ? "Retry deep dive in Tutor"
          : "Export + analyze in Tutor";

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate("/interview")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 shadow-sm hover:text-violet-700">
          <ArrowLeft size={15} /> Interview history
        </button>
        <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm disabled:opacity-60">
          {downloading ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
          {downloading ? "Preparing PDF..." : "Download PDF"}
        </button>
      </div>

      <section className="mt-5 overflow-hidden rounded-[34px] border border-violet-200/80 bg-[linear-gradient(125deg,rgba(255,255,255,0.98),rgba(245,243,255,0.94),rgba(236,254,255,0.90))] p-6 shadow-[0_24px_70px_rgba(79,70,229,0.10)] sm:p-8">
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.13em] text-violet-700"><Sparkles size={13} /> Smart Interview Report</span>
              <span className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold ${scoreTone(overallScore)}`}>{bandLabel(report?.readinessBand)}</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{report?.headline || `${interview?.targetRole} interview report`}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-slate-600">{report?.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2">{interview?.targetRole}</span>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2">{pretty(interview?.interviewType)}</span>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2">{pretty(interview?.experienceLevel)}</span>
              <span className={`rounded-xl border px-3 py-2 ${interview?.useLearnerProfile !== false ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>Learner profile {interview?.useLearnerProfile !== false ? "included" : "excluded"}</span>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2">Completed {formatDate(interview?.completedAt)}</span>
            </div>
          </div>

          <div className="mx-auto grid h-[190px] w-[190px] place-items-center rounded-full bg-[conic-gradient(from_180deg,#10b981,#22d3ee,#7c3aed,#10b981)] p-[7px] shadow-xl shadow-violet-200/50">
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Overall score</p>
                <p className="mt-1 text-5xl font-black text-slate-950">{overallScore}</p>
                <p className="text-xs font-bold text-slate-400">out of 100</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-4 rounded-[26px] border border-violet-200 bg-[linear-gradient(120deg,rgba(245,243,255,0.92),rgba(236,254,255,0.78))] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900"><BrainCircuit size={17} /> AI Tutor question-stack deep dive</div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">One click exports all {questions.length} interview questions into a dedicated Tutor conversation and generates an in-depth explanation plus a strong answer for each. Project questions use a general architectural/contextual view without inventing codebase details. This counts as one AI Tutor request.</p>
          {tutorStatus === "generating" && <p className="mt-2 inline-flex items-center gap-2 text-xs font-extrabold text-cyan-700"><LoaderCircle size={13} className="animate-spin" /> Question stack exported · Tutor is generating the brief. Open Tutor to watch it finish automatically.</p>}
          {tutorStatus === "ready" && <p className="mt-2 inline-flex items-center gap-2 text-xs font-extrabold text-emerald-700"><CheckCircle2 size={13} /> Deep dive ready in AI Tutor.</p>}
          {tutorStatus === "failed" && <p className="mt-2 text-xs font-bold text-rose-700">{tutorAnalysis.failure?.message || "The Tutor deep dive did not finish. Retry is safe; failed Tutor usage is rolled back by the existing billing flow."}</p>}
        </div>
        <button
          type="button"
          onClick={analyzeQuestionsInTutor}
          disabled={sendingToTutor}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#0891b2)] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(sendingToTutor || tutorStatus === "generating") ? <LoaderCircle size={16} className="animate-spin" /> : tutorStatus === "ready" ? <CheckCircle2 size={16} /> : tutorStatus === "failed" ? <RefreshCcw size={16} /> : <Sparkles size={16} />}
          {tutorButtonLabel}
        </button>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <MessageSquareText size={20} className="text-violet-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Answered</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{Number(report?.answeredQuestions || 0)} / {Number(report?.totalQuestions || questions.length)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Gauge size={20} className="text-cyan-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Response rate</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{Number(report?.responseRatePercent || 0)}%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Clock3 size={20} className="text-emerald-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Average answer</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{Number(report?.averageAnswerSeconds || 0)} sec</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-5 shadow-sm">
          <Zap size={20} className="text-amber-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Progression earned</p>
          <p className="mt-1 text-2xl font-black text-slate-900">+{xpEarned} XP</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {progressionReward?.antiFarmingApplied
              ? "Daily interview completion XP already earned today; achievement XP can still unlock."
              : "Includes eligible interview completion and newly unlocked achievement XP."}
          </p>
        </article>
      </section>

      {levelUp?.leveledUp && (
        <section className="mt-5 flex flex-col gap-4 rounded-[26px] border border-violet-200 bg-violet-50/70 p-5 sm:flex-row sm:items-center">
          <LevelKite level={Number(levelUp.currentLevel || 1)} size={58} />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Level up</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">You reached Level {Number(levelUp.currentLevel || 1)}.</h2>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(310px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><BarChart3 size={19} /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-cyan-700">Rubric</p><h2 className="text-xl font-black text-slate-900">How your answers performed</h2></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <MetricBar label="Relevance" value={rubric.relevance} />
              <MetricBar label="Correctness" value={rubric.correctness} />
              <MetricBar label="Clarity" value={rubric.clarity} />
              <MetricBar label="Completeness" value={rubric.completeness} />
            </div>
            <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/55 p-4 text-xs leading-5 text-slate-600">
              <strong className="text-cyan-800">Estimated speaking pace:</strong> {Number(report?.estimatedAverageWpm || 0)} words/min based on the saved transcript and answer durations. It is context only and is not treated as a personality or hiring signal.
            </div>
          </section>

          {categoryScores.length > 0 && (
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Target size={19} className="text-violet-600" /><h2 className="text-xl font-black text-slate-900">Topic/category performance</h2></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {categoryScores.map((item) => (
                  <div key={item.category} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3"><p className="font-extrabold text-slate-800">{item.category}</p><span className="text-sm font-black text-violet-700">{Number(item.score || 0)}/100</span></div>
                    <p className="mt-1 text-xs text-slate-500">{Number(item.questions || 0)} question{Number(item.questions || 0) === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><MessageSquareText size={19} className="text-violet-600" /><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-violet-600">Transcript review</p><h2 className="text-xl font-black text-slate-900">Question-by-question breakdown</h2></div></div>
            <div className="mt-5 space-y-3">
              {questions.map((turn) => (
                <details key={turn.submissionId || turn.questionNumber} className="group rounded-2xl border border-slate-200 bg-white open:border-violet-200 open:bg-violet-50/25">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                    <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Q{turn.questionNumber} · {turn.question?.category || "General"}</p><p className="mt-1 line-clamp-2 font-extrabold text-slate-800">{turn.question?.text}</p></div>
                    <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${scoreTone(turn.evaluation?.score)}`}>{Number(turn.evaluation?.score || 0)}/100</span>
                  </summary>
                  <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Your captured answer</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{turn.answerTranscript || "No verbal response"}</p>
                    {turn.answerTranscript ? (
                      <p className="mt-2 text-[11px] font-semibold text-slate-400">{Number(turn.delivery?.wordCount || 0)} words · about {Number(turn.delivery?.estimatedWpm || 0)} wpm · {Math.round(Number(turn.answerDurationMs || 0) / 1000)} sec</p>
                    ) : null}
                    <div className="mt-4 rounded-xl border border-white bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-violet-600">Astra's feedback</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{turn.evaluation?.summary || "No detailed feedback was saved for this turn."}</p>
                      {Array.isArray(turn.evaluation?.improvements) && turn.evaluation.improvements.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
                          {turn.evaluation.improvements.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/55 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900"><Trophy size={17} /> Strengths</div>
            <div className="mt-4 space-y-3">
              {(report?.strengths || []).map((item) => <div key={`${item.title}-${item.detail}`} className="rounded-xl border border-white bg-white/75 p-3"><p className="text-xs font-extrabold text-emerald-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p></div>)}
            </div>
          </section>

          <section className="rounded-[28px] border border-amber-200 bg-amber-50/55 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><Lightbulb size={17} /> Highest-value improvements</div>
            <div className="mt-4 space-y-3">
              {(report?.improvements || []).map((item) => <div key={`${item.title}-${item.detail}`} className="rounded-xl border border-white bg-white/75 p-3"><p className="text-xs font-extrabold text-amber-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p></div>)}
            </div>
          </section>

          <section className="rounded-[28px] border border-violet-200 bg-violet-50/50 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900"><Award size={17} /> Practice plan</div>
            <div className="mt-4 space-y-3">
              {(report?.practicePlan || []).map((item, index) => (
                <div key={`${item.focus}-${index}`} className="rounded-xl border border-white bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold text-slate-800">{item.focus}</p><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-violet-700">{item.priority}</span></div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.action}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><FileText size={17} /> Candidate context snapshot</div>
            <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
              <p><strong>Education:</strong> {pretty(interview?.profileSnapshot?.educationLevel) || "Not set"}</p>
              <p><strong>Program:</strong> {interview?.profileSnapshot?.program || "Not set"}</p>
              <p><strong>Stream:</strong> {interview?.profileSnapshot?.stream || "Not set"}</p>
              <p><strong>Institution:</strong> {interview?.profileSnapshot?.institutionName || "Not set"}</p>
              <p><strong>Resume:</strong> {interview?.resume?.fileName || "Not attached"}</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-cyan-200 bg-cyan-50/55 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-900"><ShieldCheck size={17} /> Practice-only interpretation</div>
            <p className="mt-2 text-xs leading-5 text-cyan-900/75">{report?.disclaimer}</p>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{report?.closingNote}</p>
          </section>

          <button type="button" onClick={() => navigate("/interview")} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-extrabold text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-700">
            <span className="inline-flex items-center gap-2"><History size={16} /> Back to interview history</span><ArrowRight size={15} />
          </button>
        </aside>
      </div>
    </DashboardLayout>
  );
}

export default SmartInterviewReportPage;
