import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import LevelKite from "../components/progression/LevelKite";
import GoogleFormsExportModal from "../components/study/GoogleFormsExportModal";
import {
  getStudySession,
  submitStudyQuiz,
} from "../services/studySessionService";
import {
  downloadStudyNotesPdf,
  getGoogleFormsExport,
} from "../services/studyExportService";
import {
  GOOGLE_FORMS_EXPORT_TASK_EVENT,
  isGoogleFormsExportTaskActive,
  startGoogleFormsExportTask,
} from "../services/googleFormsExportTaskService";
import { getRealtimeSocket } from "../utils/realtimeSocket";
import { emitProgressionChanged } from "../utils/progressionEvents";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  "The learning session could not be loaded.";

function NotesView({ output }) {
  const notes = output?.notes;

  return (
    <div className="space-y-5">
      <article className="rounded-3xl border border-indigo-200/80 bg-white/72 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-indigo-600">
          Overview
        </p>
        <p className="mt-3 leading-7 text-slate-700">
          {notes?.overview}
        </p>
      </article>

      {notes?.sections?.map((section, index) => (
        <article
          key={`${section.heading}-${index}`}
          className="rounded-3xl border border-violet-200/80 bg-white/72 p-5 shadow-sm backdrop-blur-xl sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-extrabold text-violet-700">
              {index + 1}
            </span>

            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-slate-950">
                {section.heading}
              </h2>

              <p className="mt-3 leading-7 text-slate-700">
                {section.explanation}
              </p>
            </div>
          </div>

          {section.keyPoints?.length > 0 && (
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
              <p className="text-sm font-extrabold text-indigo-800">
                Key points
              </p>

              <ul className="mt-3 space-y-2">
                {section.keyPoints.map((point, pointIndex) => (
                  <li
                    key={`${point}-${pointIndex}`}
                    className="flex gap-2 text-sm leading-6 text-slate-700"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-1 shrink-0 text-indigo-500"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.example && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                Example
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {section.example}
              </p>
            </div>
          )}
        </article>
      ))}

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-cyan-200/80 bg-cyan-50/45 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-950">
            Key takeaways
          </h2>

          <ul className="mt-4 space-y-3">
            {notes?.keyTakeaways?.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex gap-2.5 text-sm leading-6 text-slate-700"
              >
                <Sparkles
                  size={16}
                  className="mt-1 shrink-0 text-cyan-600"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-emerald-200/80 bg-emerald-50/45 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-950">
            Revision checklist
          </h2>

          <ul className="mt-4 space-y-3">
            {notes?.revisionChecklist?.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex gap-2.5 text-sm leading-6 text-slate-700"
              >
                <CheckCircle2
                  size={16}
                  className="mt-1 shrink-0 text-emerald-600"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}

function QuizView({
  studySession,
  onProgressUpdate,
}) {
  const output = studySession?.output;
  const questions = output?.quiz?.questions || [];
  const savedProgress = studySession?.quizProgress || {};
  const hasSavedAttempt = Number(savedProgress.attempts || 0) > 0;

  const initialAnswers = Array.from(
    { length: questions.length },
    (_, index) =>
      hasSavedAttempt &&
      Number.isInteger(savedProgress.latestAnswers?.[index])
        ? savedProgress.latestAnswers[index]
        : null,
  );

  const initialReview = hasSavedAttempt
    ? questions.map((question) => ({
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation || "",
      }))
    : [];

  const [answers, setAnswers] = useState(initialAnswers);
  const [submitted, setSubmitted] = useState(hasSavedAttempt);
  const [review, setReview] = useState(initialReview);
  const [result, setResult] = useState(
    hasSavedAttempt
      ? {
          score: Number(savedProgress.latestScore || 0),
          totalQuestions: Number(
            savedProgress.totalQuestions || questions.length,
          ),
          percentage: Number(savedProgress.latestPercentage || 0),
        }
      : null,
  );
  const [progressionReward, setProgressionReward] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allAnswered = useMemo(
    () =>
      answers.length === questions.length &&
      answers.every((answer) => Number.isInteger(answer)),
    [answers, questions.length],
  );

  const handleReset = () => {
    setAnswers(Array(questions.length).fill(null));
    setSubmitted(false);
    setReview([]);
    setResult(null);
    setProgressionReward(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!allAnswered || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await submitStudyQuiz(
        studySession.id,
        answers,
      );

      const progression = response?.data?.progression || null;
      setReview(response?.data?.review || []);
      setResult(response?.data?.result || null);
      setProgressionReward(progression);
      setSubmitted(true);
      onProgressUpdate?.(response?.data?.quizProgress || null);
      emitProgressionChanged();

      if (progression?.levelUp?.leveledUp) {
        toast.success(
          `Level up! You reached Level ${progression.levelUp.currentLevel}.`,
          { duration: 4500 },
        );
      } else if (Number(progression?.xpEarned || 0) > 0) {
        toast.success(`Quiz saved — +${Number(progression.xpEarned)} XP earned.`);
      } else {
        toast.success("Quiz result saved. Previously earned XP milestones were not repeated.");
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Your quiz could not be submitted. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <article className="rounded-3xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white/75 to-cyan-50/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <p className="text-sm font-bold text-violet-600">
          {output?.quiz?.title || "Session quiz"}
        </p>
        <p className="mt-2 leading-7 text-slate-600">
          {output?.quiz?.instructions ||
            "Choose one answer for each question, then check your score."}
        </p>

        {submitted && result && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <Trophy size={19} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                  Quiz result saved
                </p>
                <p className="text-lg font-extrabold text-slate-950">
                  {result.score}/{result.totalQuestions} correct · {Math.round(result.percentage)}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {Number(progressionReward?.xpEarned || 0) > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-700">
                  +{Number(progressionReward.xpEarned)} XP
                </span>
              ) : null}

              {progressionReward?.levelUp?.leveledUp ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">
                  <LevelKite level={progressionReward.levelUp.currentLevel} size={24} showTail={false} />
                  Level {progressionReward.levelUp.currentLevel}
                </span>
              ) : null}

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:-translate-y-0.5"
              >
                <RotateCcw size={16} />
                Try again
              </button>
            </div>
          </div>
        )}
      </article>

      {questions.map((question, questionIndex) => {
        const answerReview = review[questionIndex] || {};

        return (
          <article
            key={`${question.question}-${questionIndex}`}
            className="rounded-3xl border border-slate-200/90 bg-white/76 p-5 shadow-sm backdrop-blur-xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700">
                {questionIndex + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-base font-extrabold leading-7 text-slate-950 sm:text-lg">
                    {question.question}
                  </h2>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    {question.difficulty}
                  </span>
                </div>

                <div className="mt-4 grid gap-2.5">
                  {question.options.map((option, optionIndex) => {
                    const selected = answers[questionIndex] === optionIndex;
                    const isCorrect =
                      answerReview.correctOptionIndex === optionIndex;
                    const showCorrect = submitted && isCorrect;
                    const showWrong = submitted && selected && !isCorrect;

                    return (
                      <button
                        key={`${option}-${optionIndex}`}
                        type="button"
                        disabled={submitted}
                        onClick={() =>
                          setAnswers((current) =>
                            current.map((answer, index) =>
                              index === questionIndex ? optionIndex : answer,
                            ),
                          )
                        }
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition ${
                          showCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : showWrong
                              ? "border-rose-300 bg-rose-50 text-rose-900"
                              : selected
                                ? "border-violet-300 bg-violet-50 text-violet-900 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-current/20 text-xs font-extrabold">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="flex-1">{option}</span>

                        {showCorrect && (
                          <Check size={17} className="mt-1 shrink-0" />
                        )}

                        {showWrong && (
                          <X size={17} className="mt-1 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {submitted && answerReview.explanation && (
                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo-700">
                      Explanation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {answerReview.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {!submitted && (
        <button
          type="button"
          disabled={!allAnswered || isSubmitting}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200/70 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <BookOpenCheck size={18} />
          )}
          {isSubmitting ? "Saving result..." : "Check answers"}
        </button>
      )}
    </div>
  );
}

function StudySessionPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [studySession, setStudySession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    tabParam === "quiz" ? "quiz" : "notes",
  );
  const [isDownloadingPdf, setIsDownloadingPdf] =
    useState(false);
  const [isExportingForms, setIsExportingForms] =
    useState(false);
  const [googleFormsExportModalOpen, setGoogleFormsExportModalOpen] =
    useState(false);
  const [googleFormsExport, setGoogleFormsExport] =
    useState(null);
  const previousGenerationStatusRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const response = await getStudySession(sessionId);

        if (active) {
          setStudySession(response?.data?.studySession || null);
        }
      } catch (error) {
        if (active) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!studySession?.id || studySession.status !== "generating") {
      return undefined;
    }

    let active = true;
    const currentSessionId = String(studySession.id);

    const refreshPendingSession = async () => {
      try {
        const response = await getStudySession(sessionId);
        if (active) {
          setStudySession(response?.data?.studySession || null);
        }
      } catch {
        // The initial loader owns user-facing errors. Polling is best effort.
      }
    };

    const intervalId = window.setInterval(refreshPendingSession, 3000);
    const socket = getRealtimeSocket();
    const handleSessionChanged = (payload) => {
      if (String(payload?.sessionId || "") === currentSessionId) {
        refreshPendingSession();
      }
    };

    socket.emit("study-session:join", currentSessionId);
    socket.on("study-session:changed", handleSessionChanged);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      socket.emit("study-session:leave", currentSessionId);
      socket.off("study-session:changed", handleSessionChanged);
    };
  }, [sessionId, studySession?.id, studySession?.status]);

  useEffect(() => {
    const currentStatus = studySession?.status || null;
    const previousStatus = previousGenerationStatusRef.current;

    if (previousStatus === "generating" && currentStatus === "completed") {
      emitProgressionChanged();
    }

    previousGenerationStatusRef.current = currentStatus;
  }, [studySession?.status]);

  const output = studySession?.output;
  const generationType = studySession?.generationType || "combined";
  const hasNotes = Boolean(output?.notes);
  const hasQuiz = Boolean(output?.quiz?.questions?.length);
  const newGenerationPath =
    generationType === "notes"
      ? "/generate/notes"
      : generationType === "quiz"
        ? "/generate/quiz"
        : "/generate";
  const generationLabel =
    studySession?.origin === "ai_tutor"
      ? "AI Tutor quiz"
      : generationType === "notes"
        ? "Generated AI Notes"
        : generationType === "quiz"
          ? "Generated AI Quiz"
          : "Generated learning session";

  useEffect(() => {
    if (!studySession?.id || !hasQuiz) {
      setGoogleFormsExport(null);
      return;
    }

    let active = true;

    const loadGoogleFormsExport = async () => {
      try {
        const response =
          await getGoogleFormsExport(
            studySession.id,
          );

        if (active) {
          setGoogleFormsExport(
            response?.data?.studyExport ||
              null,
          );
        }
      } catch {
        if (active) {
          setGoogleFormsExport(null);
        }
      }
    };

    loadGoogleFormsExport();

    return () => {
      active = false;
    };
  }, [studySession?.id, hasQuiz]);

  useEffect(() => {
    const googleFormsStatus =
      searchParams.get("googleForms");

    if (!googleFormsStatus) {
      return;
    }

    if (googleFormsStatus === "exported") {
      toast.success(
        "Quiz exported to Google Forms.",
      );
    } else if (
      googleFormsStatus === "cancelled"
    ) {
      toast(
        "Google Forms connection was cancelled.",
      );
    } else if (
      googleFormsStatus === "error"
    ) {
      toast.error(
        "Google Forms could not finish the export. Please try again.",
      );
    }

    const nextParams =
      new URLSearchParams(searchParams);
    nextParams.delete("googleForms");

    navigate(
      {
        pathname: `/study/${sessionId}`,
        search: nextParams.toString()
          ? `?${nextParams.toString()}`
          : "",
      },
      {
        replace: true,
      },
    );
  }, [
    navigate,
    searchParams,
    sessionId,
  ]);

  const handleNotesPdfDownload = async () => {
    if (
      !studySession?.id ||
      !hasNotes ||
      isDownloadingPdf
    ) {
      return;
    }

    try {
      setIsDownloadingPdf(true);
      const result =
        await downloadStudyNotesPdf(
          studySession.id,
        );

      toast.success(
        `${result.filename} saved.`,
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "The notes PDF could not be created.",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGoogleFormsExport = (exportMode = "standard") => {
    if (!studySession?.id || !hasQuiz) {
      return;
    }

    if (isGoogleFormsExportTaskActive(studySession.id)) {
      toast(
        "This quiz is already being exported to Google Forms in the background.",
      );
      setGoogleFormsExportModalOpen(false);
      setIsExportingForms(true);
      return;
    }

    setGoogleFormsExportModalOpen(false);
    setIsExportingForms(true);

    startGoogleFormsExportTask({
      sessionId: studySession.id,
      exportMode,
    });
  };

  useEffect(() => {
    if (!studySession?.id || !hasQuiz) {
      setIsExportingForms(false);
      return undefined;
    }

    const currentSessionId = String(studySession.id);

    setIsExportingForms(
      isGoogleFormsExportTaskActive(currentSessionId),
    );

    const handleGoogleFormsTaskChanged = (event) => {
      const detail = event?.detail || {};

      if (String(detail.sessionId || "") !== currentSessionId) {
        return;
      }

      if (detail.status === "started") {
        setIsExportingForms(true);
        return;
      }

      if (detail.status === "success") {
        if (detail.studyExport) {
          setGoogleFormsExport(detail.studyExport);
        }
        setIsExportingForms(false);
        return;
      }

      if (
        detail.status === "error" ||
        detail.status === "authorization_required" ||
        detail.status === "settled"
      ) {
        setIsExportingForms(
          isGoogleFormsExportTaskActive(currentSessionId),
        );
      }
    };

    window.addEventListener(
      GOOGLE_FORMS_EXPORT_TASK_EVENT,
      handleGoogleFormsTaskChanged,
    );

    return () => {
      window.removeEventListener(
        GOOGLE_FORMS_EXPORT_TASK_EVENT,
        handleGoogleFormsTaskChanged,
      );
    };
  }, [studySession?.id, hasQuiz]);

  useEffect(() => {
    if (!studySession || !output) {
      return;
    }

    if (hasQuiz && !hasNotes) {
      setActiveTab("quiz");
    } else if (hasNotes && !hasQuiz) {
      setActiveTab("notes");
    } else {
      setActiveTab(tabParam === "quiz" ? "quiz" : "notes");
    }
  }, [studySession, output, hasNotes, hasQuiz, tabParam]);

  if (isLoading) {
    return (
      <>
        <div className="flex min-h-[55vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" />
            Loading your learning session...
          </div>
        </div>
      </>
    );
  }

  if (studySession?.status === "generating") {
    const stage = studySession.generationStage || "queued";
    const stageCopy = {
      queued: {
        label: "Queued",
        title: "Your learning session is queued",
        description: "StudyFluxAI has reserved your FluxGems and will start the AI worker shortly.",
      },
      primary: {
        label: "Generating",
        title: "Gemini is building your learning session",
        description: "The primary model is preparing your structured learning content now.",
      },
      fallback: {
        label: "Trying fallback",
        title: "StudyFluxAI switched to the fallback model",
        description: "The primary model was unavailable or returned an unusable response. Your generation is still active.",
      },
    }[stage] || {
      label: "Generating",
      title: "Your learning session is being generated",
      description: "StudyFluxAI is preparing your content in the background.",
    };

    return (
      <>
        <section className="mx-auto max-w-3xl rounded-3xl border border-violet-200/80 bg-white/80 p-6 shadow-[0_18px_50px_rgba(109,40,217,0.08)] backdrop-blur-xl sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 via-indigo-50 to-emerald-50 text-violet-600">
            <LoaderCircle size={26} className="animate-spin" />
          </div>

          <div className="mt-5 text-center">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${stage === "fallback" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-violet-200 bg-violet-50 text-violet-700"}`}>
              {stageCopy.label}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-950 sm:text-3xl">
              {stageCopy.title}
            </h1>
            <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-500">
              {stageCopy.description}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Session
                </p>
                <p className="mt-1 font-extrabold text-slate-900">
                  {studySession.topic || studySession.sourceFile?.fileName || "AI learning session"}
                </p>
              </div>
              <p className="text-sm font-extrabold text-emerald-700">
                {studySession.cost} FluxGems reserved
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-sm leading-6 text-slate-500">
            You can leave this page or open the Study Library. Generation continues in the background and this page updates automatically.
          </p>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-extrabold text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              Back to Study Library
            </button>
          </div>
        </section>
      </>
    );
  }

  if (studySession?.status === "failed") {
    return (
      <>
        <section className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white/85 p-7 text-center shadow-sm backdrop-blur-xl sm:p-9">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <X size={25} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-950">
            Generation could not be completed
          </h1>
          <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-500">
            {studySession.refundedAt
              ? `Your ${studySession.cost} FluxGems were automatically returned.`
              : "The generation stopped before usable learning content was produced."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700"
            >
              Study Library
            </button>
            <button
              type="button"
              onClick={() => navigate(newGenerationPath)}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white"
            >
              Try another generation
            </button>
          </div>
        </section>
      </>
    );
  }

  if (!studySession || !output) {
    return (
      <>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-950">
            Learning session unavailable
          </h1>
          <p className="mt-2 text-slate-500">
            This session could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => navigate(newGenerationPath)}
            className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Create another session
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/85 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            aria-label="Back to study library"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-violet-600">
                {generationLabel}
              </p>

              {studySession.origin === "ai_tutor" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-gradient-to-r from-violet-50 to-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-cyan-800">
                  <BrainCircuit size={12} />
                  Made with AI Tutor
                </span>
              )}

              {studySession.fallbackUsed && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-700">
                  Fallback model used
                </span>
              )}
            </div>

            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
              {output.sessionTitle}
            </h1>

            <p className="mt-2 max-w-3xl leading-7 text-muted">
              {output.shortDescription}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(newGenerationPath)}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-extrabold text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
        >
          <Sparkles size={17} />
          {generationType === "notes"
            ? "New Notes"
            : generationType === "quiz"
              ? "New Quiz"
              : "New session"}
        </button>
      </section>

      <section className={`mt-6 grid gap-3 ${hasNotes && hasQuiz ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/55 p-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <Clock3 size={17} />
            <span className="text-xs font-extrabold uppercase tracking-[0.12em]">
              {generationType === "quiz" ? "Quiz time" : "Study time"}
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-950">
            ~{output.estimatedStudyMinutes} min
          </p>
        </div>

        {hasNotes && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/55 p-4">
            <div className="flex items-center gap-2 text-violet-700">
              <FileText size={17} />
              <span className="text-xs font-extrabold uppercase tracking-[0.12em]">
                Notes sections
              </span>
            </div>
            <p className="mt-2 text-xl font-extrabold text-slate-950">
              {output.notes?.sections?.length || 0}
            </p>
          </div>
        )}

        {hasQuiz && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/55 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <BookOpenCheck size={17} />
              <span className="text-xs font-extrabold uppercase tracking-[0.12em]">
                Quiz questions
              </span>
            </div>
            <p className="mt-2 text-xl font-extrabold text-slate-950">
              {output.quiz?.questions?.length || 0}
            </p>
          </div>
        )}
      </section>

      {(hasNotes || hasQuiz) && (
        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/65 p-3 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Export
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Keep your saved StudyFluxAI content usable outside the app.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {hasNotes && (
              <button
                type="button"
                disabled={isDownloadingPdf}
                onClick={handleNotesPdfDownload}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/75 px-4 py-2.5 text-sm font-extrabold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloadingPdf ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Download size={16} />
                )}
                {isDownloadingPdf
                  ? "Creating PDF..."
                  : "Save notes as PDF"}
              </button>
            )}

            {hasQuiz &&
              (googleFormsExport ? (
                <>
                  {googleFormsExport.responderUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          googleFormsExport.responderUrl,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/75 px-4 py-2.5 text-sm font-extrabold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    >
                      <ExternalLink size={16} />
                      Open Google quiz
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        googleFormsExport.editUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50/75 px-4 py-2.5 text-sm font-extrabold text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-50"
                  >
                    <BookOpenCheck size={16} />
                    Edit in Google Forms
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isExportingForms}
                  onClick={() => setGoogleFormsExportModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExportingForms ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <BookOpenCheck size={16} />
                  )}
                  {isExportingForms
                    ? "Exporting..."
                    : "Export quiz to Google Forms"}
                </button>
              ))}
          </div>
        </section>
      )}

      {hasNotes && hasQuiz && (
        <div className="mt-6 flex w-full max-w-md rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
              activeTab === "notes"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Notes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
              activeTab === "quiz"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Quiz
          </button>
        </div>
      )}

      <section className="mt-5">
        {hasNotes && (activeTab === "notes" || !hasQuiz) ? (
          <NotesView output={output} />
        ) : hasQuiz ? (
          <QuizView
            studySession={studySession}
            onProgressUpdate={(quizProgress) => {
              if (!quizProgress) {
                return;
              }

              setStudySession((current) =>
                current
                  ? {
                      ...current,
                      quizProgress,
                    }
                  : current,
              );
            }}
          />
        ) : null}
      </section>

      <GoogleFormsExportModal
        open={googleFormsExportModalOpen}
        loading={isExportingForms}
        onClose={() => setGoogleFormsExportModalOpen(false)}
        onExport={handleGoogleFormsExport}
      />
    </>
  );
}

export default StudySessionPage;
