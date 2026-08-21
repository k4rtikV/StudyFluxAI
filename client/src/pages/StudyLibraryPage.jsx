import {
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import useAuth from "../hooks/useAuth";
import { listStudySessions } from "../services/studySessionService";
import { getRealtimeSocket } from "../utils/realtimeSocket";

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const getErrorMessage = (error) =>
  error?.response?.data?.message || "Your study library could not be loaded.";

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

const TYPE_OPTIONS = [
  ["all", "All content"],
  ["combined", "Notes + Quiz"],
  ["notes", "AI Notes"],
  ["quiz", "AI Quiz"],
];
const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["ready", "Ready"],
  ["generating", "Generating"],
  ["failed", "Failed"],
];
const ORIGIN_OPTIONS = [
  ["all", "All sources"],
  ["ai_generation", "StudyFluxAI"],
  ["ai_tutor", "AI Tutor"],
];
const SORT_OPTIONS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
];

const librarySnapshots = new Map();

const getLibrarySnapshot = (userId) =>
  librarySnapshots.get(String(userId || "anonymous")) || null;

function FilterSelect({ value, onChange, label, options }) {
  return (
    <label className="relative min-w-[150px] flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white/90 pl-3 pr-9 text-xs font-extrabold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 sm:w-auto sm:min-w-[150px]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

function StudyLibraryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = String(user?.id || user?._id || "anonymous");
  const cachedSnapshot = getLibrarySnapshot(cacheKey);
  const [sessions, setSessions] = useState(() =>
    Array.isArray(cachedSnapshot?.sessions) ? cachedSnapshot.sessions : [],
  );
  const [isLoading, setIsLoading] = useState(() => !Array.isArray(cachedSnapshot?.sessions));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const loadSessions = useCallback(async (showError = true, { foreground = false } = {}) => {
    try {
      if (foreground) setIsLoading(true);
      const response = await listStudySessions(100, "", true);
      const nextSessions = response?.data?.studySessions || [];
      librarySnapshots.set(cacheKey, { sessions: nextSessions, updatedAt: Date.now() });
      setSessions(nextSessions);
    } catch (error) {
      if (showError) toast.error(getErrorMessage(error));
    } finally {
      if (foreground) setIsLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    const snapshot = getLibrarySnapshot(cacheKey);
    const hasSnapshot = Array.isArray(snapshot?.sessions);
    if (hasSnapshot) setSessions(snapshot.sessions);
    loadSessions(!hasSnapshot, { foreground: !hasSnapshot });
  }, [cacheKey, loadSessions]);

  useEffect(() => {
    const pendingIds = sessions
      .filter((session) => session.status === "generating")
      .map((session) => String(session.id));

    if (pendingIds.length === 0) return undefined;

    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      loadSessions(false);
    };
    const intervalId = window.setInterval(refresh, 10000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const socket = getRealtimeSocket();
    const handleSessionChanged = (payload) => {
      if (pendingIds.includes(String(payload?.sessionId || ""))) refresh();
    };

    pendingIds.forEach((sessionId) => socket.emit("study-session:join", sessionId));
    socket.on("study-session:changed", handleSessionChanged);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      pendingIds.forEach((sessionId) => socket.emit("study-session:leave", sessionId));
      socket.off("study-session:changed", handleSessionChanged);
    };
  }, [loadSessions, sessions]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions
      .filter((session) => {
        const generationType = session.generationType || "combined";
        const status = session.status === "completed" ? "ready" : session.status;
        const origin = session.origin || "ai_generation";
        if (typeFilter !== "all" && generationType !== typeFilter) return false;
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (originFilter !== "all" && origin !== originFilter) return false;
        if (!query) return true;
        return [session.title, session.description, session.topic, session.sourceFile?.fileName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const delta = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return sort === "oldest" ? -delta : delta;
      });
  }, [originFilter, search, sessions, sort, statusFilter, typeFilter]);

  const filtersActive = Boolean(
    search.trim() ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    originFilter !== "all" ||
    sort !== "newest",
  );

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setOriginFilter("all");
    setSort("newest");
  };

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-600">Your learning archive</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">Study Library</h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Notes, quizzes and combined study sessions share one consistent, recoverable history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/generate")}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-200/60 transition hover:-translate-y-0.5"
        >
          <Sparkles size={17} /> New combined session
        </button>
      </section>

      {!isLoading && sessions.length > 0 && (
        <section className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, topics or source files"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white/90 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <FilterSelect label="Content type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
              <FilterSelect label="Source" value={originFilter} onChange={setOriginFilter} options={ORIGIN_OPTIONS} />
              <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORT_OPTIONS} />
              <button
                type="button"
                onClick={resetFilters}
                disabled={!filtersActive}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
          <p className="mt-3 px-1 text-xs font-bold text-slate-400">
            Showing {filteredSessions.length} of {sessions.length} saved item{sessions.length === 1 ? "" : "s"}.
          </p>
        </section>
      )}

      {isLoading ? (
        <div className="mt-8 flex min-h-[45vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" /> Loading your study library...
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <section className="mt-7 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200 bg-white/60 px-6 text-center shadow-sm backdrop-blur-xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><BookOpenCheck size={25} /></div>
          <h2 className="mt-5 text-xl font-extrabold text-slate-900">Your library is ready for its first item</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Every successful combined session, standalone note set and standalone quiz is saved here automatically.</p>
          <button type="button" onClick={() => navigate("/generate")} className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Generate a session</button>
        </section>
      ) : filteredSessions.length === 0 ? (
        <section className="mt-7 flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/60 px-6 text-center">
          <Search size={26} className="text-slate-400" />
          <h2 className="mt-4 text-lg font-extrabold text-slate-900">No library items match these filters</h2>
          <p className="mt-2 text-sm text-slate-500">Clear or adjust the filters to bring saved study material back into view.</p>
          <button type="button" onClick={resetFilters} className="mt-4 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-extrabold text-violet-700">Reset filters</button>
        </section>
      ) : (
        <section className="mt-6 grid items-stretch gap-5 xl:grid-cols-2">
          {filteredSessions.map((session) => {
            const generationType = session.generationType || "combined";
            const meta = TYPE_META[generationType] || TYPE_META.combined;
            const TypeIcon = meta.Icon;
            const isGenerating = session.status === "generating";
            const isFailed = session.status === "failed";
            const isCompleted = session.status === "completed";
            const hasQuiz = isCompleted && Boolean(session.hasQuiz);
            const attempts = Number(session.quizProgress?.attempts || 0);
            const latestScore = Number(session.quizProgress?.latestScore || 0);
            const totalQuestions = Number(session.quizProgress?.totalQuestions || session.quizSize || 0);

            const contentValue = isGenerating
              ? session.generationStage === "fallback" ? "Fallback model" : session.generationStage === "primary" ? "AI generating" : "Waiting for worker"
              : isFailed
                ? "Generation stopped"
                : generationType === "combined"
                  ? `Notes + ${totalQuestions || session.quizSize || 0} questions`
                  : generationType === "quiz"
                    ? `${totalQuestions || session.quizSize || 0} questions`
                    : "Notes";

            const statusValue = isGenerating
              ? session.generationStage === "fallback" ? "Trying fallback" : "In progress"
              : isFailed
                ? session.refundedAt ? "Failed · Refunded" : "Failed"
                : hasQuiz
                  ? attempts > 0 ? `${latestScore}/${totalQuestions} · Completed` : "Quiz not attempted"
                  : "Ready to review";

            let actionLabel = "Open session";
            let ActionIcon = BookOpenCheck;
            let actionPath = `/study/${session.id}`;
            if (isGenerating) {
              actionLabel = "View progress";
              ActionIcon = LoaderCircle;
            } else if (isFailed) {
              actionLabel = "View status";
              ActionIcon = Clock3;
            } else if (generationType === "notes") {
              actionLabel = "Open notes";
              ActionIcon = FileText;
            } else if (generationType === "quiz") {
              actionLabel = attempts > 0 ? "Review quiz" : "Take quiz";
              ActionIcon = PlayCircle;
              actionPath = `/study/${session.id}?tab=quiz`;
            }

            return (
              <article
                key={session.id}
                className="group flex h-full flex-col rounded-3xl border border-violet-200/80 bg-white/72 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:bg-white/90 hover:shadow-[0_20px_42px_rgba(109,40,217,0.10)] sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${meta.badge}`}><TypeIcon size={12} /> {meta.label}</span>
                  {session.origin === "ai_tutor" && <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-gradient-to-r from-violet-50 to-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-cyan-800"><BrainCircuit size={12} /> AI Tutor</span>}
                  {isGenerating && <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-violet-700"><LoaderCircle size={12} className="animate-spin" /> {statusValue}</span>}
                  {isFailed && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-rose-700">{statusValue}</span>}
                  {hasQuiz && attempts > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700"><CheckCircle2 size={12} /> Quiz completed</span>}
                </div>

                <h2 className="mt-4 text-xl font-extrabold leading-7 text-slate-950">{session.title}</h2>
                <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-slate-500">
                  {session.description || (isGenerating ? "StudyFluxAI is preparing this item in the background. You can safely leave this page." : isFailed ? session.failureMessage || "Generation stopped before usable content was produced." : "Saved learning content ready to reopen.")}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Created</span></div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">{formatDate(session.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500"><BookOpenCheck size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Content</span></div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">{contentValue}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500"><Clock3 size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Status</span></div>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">{statusValue}</p>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="button"
                    onClick={() => navigate(actionPath)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${isFailed ? "border border-rose-200 bg-rose-50 text-rose-700" : "bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 text-white shadow-sm"}`}
                  >
                    <ActionIcon size={16} className={isGenerating ? "animate-spin" : ""} /> {actionLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

export default StudyLibraryPage;
