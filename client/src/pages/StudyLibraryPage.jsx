import {
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import DashboardLayout from "../layouts/DashboardLayout";
import { listStudySessions } from "../services/studySessionService";
import { getRealtimeSocket } from "../utils/realtimeSocket";

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  "Your study library could not be loaded.";

const TYPE_META = {
  combined: {
    label: "Notes + Quiz",
    Icon: Sparkles,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  notes: {
    label: "AI Notes",
    Icon: NotebookPen,
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  quiz: {
    label: "AI Quiz",
    Icon: Lightbulb,
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

function StudyLibraryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async (showError = true) => {
    try {
      const response = await listStudySessions(40, "", true);
      setSessions(response?.data?.studySessions || []);
    } catch (error) {
      if (showError) {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const pendingIds = sessions
      .filter((session) => session.status === "generating")
      .map((session) => String(session.id));

    if (pendingIds.length === 0) {
      return undefined;
    }

    const refresh = () => loadSessions(false);
    const intervalId = window.setInterval(refresh, 4000);
    const socket = getRealtimeSocket();
    const handleSessionChanged = (payload) => {
      if (pendingIds.includes(String(payload?.sessionId || ""))) {
        refresh();
      }
    };

    pendingIds.forEach((sessionId) => {
      socket.emit("study-session:join", sessionId);
    });
    socket.on("study-session:changed", handleSessionChanged);

    return () => {
      window.clearInterval(intervalId);
      pendingIds.forEach((sessionId) => {
        socket.emit("study-session:leave", sessionId);
      });
      socket.off("study-session:changed", handleSessionChanged);
    };
  }, [loadSessions, sessions]);

  return (
    <DashboardLayout>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-600">Your learning archive</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Study Library
          </h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Combined sessions, standalone AI Notes and standalone quizzes all share one recoverable history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/generate")}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-200/60 transition hover:-translate-y-0.5"
        >
          <Sparkles size={17} />
          New combined session
        </button>
      </section>

      {isLoading ? (
        <div className="mt-8 flex min-h-[45vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" />
            Loading your study library...
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <section className="mt-7 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200 bg-white/60 px-6 text-center shadow-sm backdrop-blur-xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <BookOpenCheck size={25} />
          </div>
          <h2 className="mt-5 text-xl font-extrabold text-slate-900">
            Your library is ready for its first item
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Every successful combined session, standalone notes generation and standalone quiz is saved here automatically.
          </p>
          <button
            type="button"
            onClick={() => navigate("/generate")}
            className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
          >
            Generate a session
          </button>
        </section>
      ) : (
        <section className="mt-7 grid gap-5 xl:grid-cols-2">
          {sessions.map((session) => {
            const generationType = session.generationType || "combined";
            const meta = TYPE_META[generationType] || TYPE_META.combined;
            const TypeIcon = meta.Icon;
            const isGenerating = session.status === "generating";
            const isFailed = session.status === "failed";
            const isCompleted = session.status === "completed";
            const hasNotes = isCompleted && Boolean(session.hasNotes);
            const hasQuiz = isCompleted && Boolean(session.hasQuiz);
            const attempts = Number(session.quizProgress?.attempts || 0);
            const latestScore = Number(session.quizProgress?.latestScore || 0);
            const totalQuestions = Number(
              session.quizProgress?.totalQuestions || session.quizSize || 0,
            );

            return (
              <article
                key={session.id}
                className="group rounded-3xl border border-violet-200/80 bg-white/72 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:bg-white/90 hover:shadow-[0_20px_42px_rgba(109,40,217,0.10)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${meta.badge}`}>
                        <TypeIcon size={12} />
                        {meta.label}
                      </span>

                      {session.origin === "ai_tutor" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-gradient-to-r from-violet-50 to-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-cyan-800">
                          <BrainCircuit size={12} />
                          Made with AI Tutor
                        </span>
                      )}

                      {isGenerating && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${session.generationStage === "fallback" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-violet-200 bg-violet-50 text-violet-700"}`}>
                          <LoaderCircle size={12} className="animate-spin" />
                          {session.generationStage === "fallback"
                            ? "Trying fallback"
                            : session.generationStage === "primary"
                              ? "Generating"
                              : "Queued"}
                        </span>
                      )}

                      {isFailed && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-rose-700">
                          Failed · {session.refundedAt ? "Refunded" : "Stopped"}
                        </span>
                      )}

                      {hasQuiz && (
                        attempts > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">
                            <CheckCircle2 size={12} />
                            Quiz completed
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-700">
                            Quiz waiting
                          </span>
                        )
                      )}
                    </div>

                    <h2 className="mt-4 text-xl font-extrabold leading-7 text-slate-950">
                      {session.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                      {session.description ||
                        (isGenerating
                          ? "StudyFluxAI is preparing this learning item in the background. You can safely leave this page."
                          : isFailed
                            ? session.refundedAt
                              ? "Generation did not complete and the reserved FluxGems were returned automatically."
                              : "Generation stopped before usable content was produced."
                            : "Saved learning content.")}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <CalendarDays size={15} />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Created</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">
                      {formatDate(session.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <BookOpenCheck size={15} />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Content</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">
                      {isGenerating
                        ? session.generationStage === "fallback"
                          ? "Fallback model"
                          : session.generationStage === "primary"
                            ? "AI generating"
                            : "Waiting for worker"
                        : isFailed
                          ? "Generation failed"
                          : hasQuiz
                            ? `${session.quizSize} questions`
                            : "Notes only"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock3 size={15} />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">
                        {isGenerating || isFailed ? "FluxGems" : hasQuiz ? "Quiz status" : "FluxGems"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">
                      {isGenerating
                        ? `${session.cost} reserved`
                        : isFailed
                          ? session.refundedAt
                            ? `${session.cost} refunded`
                            : `${session.cost} pending`
                          : hasQuiz
                            ? attempts > 0
                              ? `${latestScore}/${totalQuestions}`
                              : "Not attempted"
                            : `${session.cost} spent`}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/study/${session.id}`)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5"
                    >
                      <LoaderCircle size={16} className="animate-spin" />
                      View generation
                    </button>
                  ) : isFailed ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/study/${session.id}`)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-700 transition hover:-translate-y-0.5"
                    >
                      View status
                    </button>
                  ) : (
                    <>
                      {hasNotes && (
                        <button
                          type="button"
                          onClick={() => navigate(`/study/${session.id}`)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-sm font-extrabold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50"
                        >
                          <FileText size={16} />
                          Open notes
                        </button>
                      )}

                      {hasQuiz && (
                        <button
                          type="button"
                          onClick={() => navigate(`/study/${session.id}?tab=quiz`)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5"
                        >
                          <PlayCircle size={16} />
                          {attempts > 0 ? "Review quiz" : "Take quiz"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </DashboardLayout>
  );
}

export default StudyLibraryPage;
