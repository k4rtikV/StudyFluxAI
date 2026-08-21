import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import useAuth from "../hooks/useAuth";
import { getLearningProfile } from "../services/learningProfileService";
import { generateStudySession } from "../services/studySessionService";

const GENERATION_COST = 50;

const DETAIL_OPTIONS = [
  {
    value: "concise",
    label: "Concise",
    helper: "Fast revision notes",
  },
  {
    value: "balanced",
    label: "Balanced",
    helper: "Best everyday depth",
  },
  {
    value: "deep",
    label: "Deep",
    helper: "More detailed coverage",
  },
];

const DIFFICULTY_OPTIONS = [
  {
    value: "profile",
    label: "Use my level",
  },
  {
    value: "easy",
    label: "Easy",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "hard",
    label: "Hard",
  },
];

const QUIZ_OPTIONS = [5, 10, 15];

const prettify = (value) => {
  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getApiErrorMessage = (error) =>
  error?.response?.data?.message ||
  "The learning session could not be generated. Please try again.";

function ContextChip({
  label,
  value,
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/80 bg-white/65 px-4 py-3 shadow-sm backdrop-blur">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function GeneratePage() {
  const navigate = useNavigate();
  const {
    user,
    setUser,
  } = useAuth();

  const [sourceMode, setSourceMode] =
    useState("topic");
  const [topic, setTopic] =
    useState("");
  const [sourceFile, setSourceFile] =
    useState(null);
  const [detailLevel, setDetailLevel] =
    useState("balanced");
  const [difficulty, setDifficulty] =
    useState("profile");
  const [quizSize, setQuizSize] =
    useState(10);
  const [profile, setProfile] =
    useState(null);
  const [isProfileLoading, setIsProfileLoading] =
    useState(true);
  const [isGenerating, setIsGenerating] =
    useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await getLearningProfile();

        if (!active) {
          return;
        }

        setProfile(
          response?.data?.profile || null,
        );
      } catch {
        if (active) {
          toast.error(
            "Your learning profile could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setIsProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const profileContext = useMemo(
    () => [
      {
        label: "Level",
        value: prettify(
          profile?.educationLevel,
        ),
      },
      {
        label: "Institution",
        value: profile?.institutionName || "",
      },
      {
        label: "Program",
        value: profile?.program || "",
      },
      {
        label: "Stream",
        value: profile?.stream || "",
      },
    ],
    [profile],
  );

  const fluxGems = Number(user?.fluxGems || 0);
  const hasEnoughFluxGems = fluxGems >= GENERATION_COST;

  const updateBalance = (balance) => {
    if (!Number.isFinite(Number(balance))) {
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            fluxGems: Number(balance),
          }
        : current,
    );
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const maxBytes = 10 * 1024 * 1024;

    if (file.size > maxBytes) {
      toast.error(
        "Choose a source file smaller than 10 MB.",
      );
      event.target.value = "";
      return;
    }

    setSourceFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      sourceMode === "topic" &&
      topic.trim().length < 3
    ) {
      toast.error(
        "Enter a topic with at least 3 characters.",
      );
      return;
    }

    if (
      sourceMode === "source" &&
      !sourceFile
    ) {
      toast.error(
        "Upload a source before continuing.",
      );
      return;
    }

    if (!hasEnoughFluxGems) {
      toast.error(
        `You need ${GENERATION_COST} FluxGems to generate this session.`,
      );
      return;
    }

    try {
      setIsGenerating(true);

      const response = await generateStudySession({
        sourceMode,
        topic: topic.trim(),
        sourceFile,
        detailLevel,
        difficulty,
        quizSize,
      });

      updateBalance(
        response?.data?.fluxGems?.balance,
      );

      const sessionId =
        response?.data?.studySession?.id;

      if (!sessionId) {
        throw new Error(
          "The generated session ID is missing.",
        );
      }

      toast.success(
        response.message ||
          "Generation started. You can continue browsing while it finishes.",
      );

      navigate(`/study/${sessionId}`);
    } catch (error) {
      const responseData = error?.response?.data;

      if (
        responseData?.data?.balance !== undefined
      ) {
        updateBalance(responseData.data.balance);
      }

      toast.error(getApiErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <p className="text-sm font-bold text-violet-600">
              AI Notes + Quiz
            </p>

            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
              Create a learning session
            </h1>

            <p className="mt-2 max-w-3xl leading-7 text-muted">
              Give StudyFluxAI a topic or study source.
              Your learning profile will shape the notes
              and matching quiz around your current level.
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-emerald-200/90 bg-white/72 px-4 py-3 shadow-sm backdrop-blur-xl">
          <FluxGemMark size={38} />

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
              Session cost
            </p>

            <p className="text-sm font-extrabold text-slate-900">
              {GENERATION_COST} FluxGems
            </p>

            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              Balance: {fluxGems}
            </p>
          </div>
        </div>
      </section>

      <section className="relative mt-6 overflow-hidden rounded-3xl border border-violet-300/80 bg-gradient-to-br from-indigo-100/90 via-violet-100/76 to-cyan-50/76 p-5 shadow-[0_18px_48px_rgba(109,40,217,0.12)] backdrop-blur-2xl sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-400/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[35%] h-56 w-56 rounded-full bg-cyan-300/26 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-200/80">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
                Personalized by default
              </p>

              <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                Built around {user?.fullName?.split(" ")[0] || "your"} learning context.
              </h2>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Your saved education level, institution,
                program and stream act as the baseline.
                You can still override session difficulty
                below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/profile/edit")}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/76 px-4 py-2.5 text-sm font-extrabold text-violet-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-white"
          >
            <GraduationCap size={17} />
            Edit learning profile
          </button>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isProfileLoading ? (
            <div className="col-span-full flex items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-4 py-4 text-sm font-semibold text-slate-500 backdrop-blur">
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
              Loading your learning context...
            </div>
          ) : (
            profileContext.map(({ label, value }) => (
              <ContextChip
                key={label}
                label={label}
                value={value}
              />
            ))
          )}
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(330px,0.72fr)]"
      >
        <div className="space-y-5">
          <article className="rounded-3xl border border-indigo-200/90 bg-white/70 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-brand-600">
                  1. Choose your source
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  What should we build from?
                </h2>
              </div>

              <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setSourceMode("topic")}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    sourceMode === "topic"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Topic
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setSourceMode("source")}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    sourceMode === "source"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Upload
                </button>
              </div>
            </div>

            {sourceMode === "topic" ? (
              <div className="mt-5">
                <label
                  htmlFor="study-topic"
                  className="text-sm font-bold text-slate-700"
                >
                  Topic
                </label>

                <textarea
                  id="study-topic"
                  value={topic}
                  maxLength={180}
                  disabled={isGenerating}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={5}
                  placeholder="Example: Explain database normalization with 1NF, 2NF, 3NF and practical examples"
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70 disabled:opacity-60"
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Be specific for more focused notes.
                  </p>

                  <p className="text-xs font-bold text-slate-400">
                    {topic.length}/180
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                {sourceFile ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm">
                      <FileText size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900">
                        {sourceFile.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {(sourceFile.size / 1024 / 1024).toFixed(2)} MB ready to use
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setSourceFile(null)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-rose-600 disabled:opacity-50"
                      aria-label="Remove source file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/35 px-6 py-10 text-center transition hover:border-indigo-300 hover:bg-indigo-50/60">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                      disabled={isGenerating}
                      onChange={handleFileChange}
                      className="sr-only"
                    />

                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:-translate-y-0.5">
                      <Upload size={21} />
                    </div>

                    <p className="mt-4 font-extrabold text-slate-900">
                      Upload study material
                    </p>

                    <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
                      PDF, TXT or Markdown. PDF diagrams,
                      tables and page layouts are passed to
                      Gemini as document input.
                    </p>

                    <span className="mt-3 text-xs font-bold text-indigo-600">
                      Maximum 10 MB
                    </span>
                  </label>
                )}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-cyan-200/90 bg-white/70 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div>
              <p className="text-sm font-bold text-cyan-700">
                2. Shape the session
              </p>

              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                Choose the learning depth
              </h2>
            </div>

            <div className="mt-5">
              <p className="text-sm font-bold text-slate-700">
                Notes detail
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {DETAIL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setDetailLevel(option.value)}
                    className={`rounded-2xl border p-4 text-left transition-all disabled:opacity-60 ${
                      detailLevel === option.value
                        ? "border-violet-300 bg-violet-50/80 shadow-sm"
                        : "border-slate-200 bg-white/70 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-900">
                        {option.label}
                      </span>

                      {detailLevel === option.value && (
                        <CheckCircle2
                          size={17}
                          className="text-violet-600"
                        />
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {option.helper}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="difficulty"
                  className="text-sm font-bold text-slate-700"
                >
                  Quiz difficulty
                </label>

                <select
                  id="difficulty"
                  value={difficulty}
                  disabled={isGenerating}
                  onChange={(event) => setDifficulty(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70 disabled:opacity-60"
                >
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700">
                  Quiz length
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {QUIZ_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setQuizSize(count)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-extrabold transition disabled:opacity-60 ${
                        quizSize === count
                          ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                          : "border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>

        <aside className="space-y-5">
          <article className="sticky top-[100px] rounded-3xl border border-emerald-300/90 bg-gradient-to-br from-emerald-100/92 via-cyan-50/78 to-violet-50/70 p-5 shadow-[0_18px_44px_rgba(16,185,129,0.12)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-700">
                  Session preview
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                  Notes + matching quiz
                </h2>
              </div>

              <FluxGemMark size={44} />
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/68 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <NotebookPen size={18} />
                </div>

                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    Structured notes
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Overview, focused sections, key ideas,
                    examples and revision takeaways.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/68 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                  <Lightbulb size={18} />
                </div>

                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {quizSize}-question quiz
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Four-option MCQs with answer
                    explanations matched to the session.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/68 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                  <BookOpenCheck size={18} />
                </div>

                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    Personalized difficulty
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {difficulty === "profile"
                      ? "Uses your saved learning level."
                      : `${prettify(difficulty)} difficulty override.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-white/72 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-slate-600">
                  Generation cost
                </span>

                <span className="text-sm font-extrabold text-emerald-700">
                  {GENERATION_COST} FluxGems
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 text-xs">
                <span className="text-slate-500">
                  Your balance
                </span>
                <span
                  className={`font-extrabold ${
                    hasEnoughFluxGems
                      ? "text-slate-700"
                      : "text-rose-600"
                  }`}
                >
                  {fluxGems}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                FluxGems are reserved before the AI call.
                If both Gemini models fail, the server
                automatically returns the full charge.
              </p>
            </div>

            {!hasEnoughFluxGems && (
              <button
                type="button"
                onClick={() => navigate("/wallet")}
                className="mt-4 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-700 transition hover:bg-rose-100"
              >
                Need {GENERATION_COST - fluxGems} more FluxGems
              </button>
            )}

            <button
              type="submit"
              disabled={
                isGenerating ||
                isProfileLoading ||
                !hasEnoughFluxGems
              }
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200/70 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-200/80 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
            >
              {isGenerating ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Sparkles size={18} />
              )}

              {isGenerating
                ? "Starting generation..."
                : "Generate learning session"}
            </button>

            <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <Zap
                size={15}
                className="mt-0.5 shrink-0 text-amber-500"
              />

              <p>
                StudyFluxAI tries the primary Gemini model
                first and only uses the fallback for eligible
                transient, quota, availability or invalid-output failures.
              </p>
            </div>
          </article>
        </aside>
      </form>
    </>
  );
}

export default GeneratePage;
