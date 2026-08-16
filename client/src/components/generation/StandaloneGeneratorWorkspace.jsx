import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  RefreshCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import InstitutionSearchSelect from "../common/InstitutionSearchSelect";
import SearchableSelect from "../common/SearchableSelect";
import {
  INDIA_STATES,
  getInstitutionsForState,
} from "../../data/institutionCatalog";
import {
  BOARD_OPTIONS,
  EDUCATION_OPTIONS,
  OTHER_VALUE,
  getInstitutionTypeForLevel,
  getProgramOptions,
  getStreamOptions,
  levelUsesProgram,
  levelUsesStream,
} from "../../data/learningCatalog";
import useAuth from "../../hooks/useAuth";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getLearningProfile } from "../../services/learningProfileService";
import { generateStudySession } from "../../services/studySessionService";
import FluxGemMark from "../dashboard/FluxGemMark";

const GENERATION_COST = 25;
const QUIZ_OPTIONS = [5, 10, 15];
const DETAIL_OPTIONS = [
  { value: "concise", label: "Concise", helper: "Fast revision notes" },
  { value: "balanced", label: "Balanced", helper: "Everyday learning depth" },
  { value: "deep", label: "Deep", helper: "More complete coverage" },
];
const DIFFICULTY_OPTIONS = [
  { value: "profile", label: "Use my level" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const getApiErrorMessage = (error) =>
  error?.response?.data?.message ||
  "The requested content could not be generated. Please try again.";

const emptyContext = {
  educationLevel: "",
  institutionState: "",
  institutionChoice: "",
  customInstitutionName: "",
  programChoice: "",
  customProgram: "",
  streamChoice: "",
  customStream: "",
};

const profileToContext = (profile) => ({
  educationLevel: profile?.educationLevel || "",
  institutionState: profile?.institutionState || "",
  institutionChoice:
    profile?.institutionId ||
    profile?.institutionKey ||
    "",
  customInstitutionName:
    profile?.institutionKey === OTHER_VALUE
      ? profile?.institutionName || ""
      : "",
  programChoice:
    profile?.programKey ||
    profile?.program ||
    "",
  customProgram:
    profile?.programKey === OTHER_VALUE
      ? profile?.program || ""
      : "",
  streamChoice:
    profile?.streamKey ||
    profile?.stream ||
    "",
  customStream:
    profile?.streamKey === OTHER_VALUE
      ? profile?.stream || ""
      : "",
});

function CustomContextInput({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100/70"
      />
    </label>
  );
}

function StandaloneGeneratorWorkspace({ generationType }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isNotes = generationType === "notes";

  const [sourceMode, setSourceMode] = useState("topic");
  const [topic, setTopic] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState("balanced");
  const [difficulty, setDifficulty] = useState("profile");
  const [quizSize, setQuizSize] = useState(10);
  const [profile, setProfile] = useState(null);
  const [academicContext, setAcademicContext] = useState(emptyContext);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await getLearningProfile();
        const loadedProfile = response?.data?.profile || null;

        if (!active) {
          return;
        }

        setProfile(loadedProfile);
        setAcademicContext(profileToContext(loadedProfile));
      } catch {
        if (active) {
          toast.error("Your learning profile could not be loaded.");
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

  const page = useMemo(
    () =>
      isNotes
        ? {
            eyebrow: "Standalone AI Notes",
            title: "Generate focused study notes",
            description:
              "Create notes only from a topic or source. No quiz is generated, so you only spend the Notes portion of the full learning session.",
            icon: NotebookPen,
            accent: "indigo",
            action: "Generate AI Notes",
            previewTitle: "Structured notes only",
          }
        : {
            eyebrow: "Standalone Quiz Generator",
            title: "Generate a practice quiz",
            description:
              "Create a quiz only from a topic or source. No study notes are generated, so you only spend the Quiz portion of the full learning session.",
            icon: Lightbulb,
            accent: "violet",
            action: "Generate Quiz",
            previewTitle: `${quizSize}-question quiz only`,
          },
    [isNotes, quizSize],
  );

  const PageIcon = page.icon;
  const fluxGems = Number(user?.fluxGems || 0);
  const hasEnoughFluxGems = fluxGems >= GENERATION_COST;

  const educationLevel =
    academicContext.educationLevel;
  const institutionState =
    academicContext.institutionState;
  const institutionChoice =
    academicContext.institutionChoice;
  const programChoice =
    academicContext.programChoice;
  const streamChoice =
    academicContext.streamChoice;

  const institutionType =
    getInstitutionTypeForLevel(
      educationLevel,
    );
  const boardFlow =
    institutionType === "board";
  const usesProgram =
    levelUsesProgram(educationLevel);
  const usesStream =
    levelUsesStream(educationLevel);

  const institutionOptions =
    getInstitutionsForState(
      institutionState,
      educationLevel,
    );
  const programOptions =
    getProgramOptions(educationLevel);
  const streamOptions =
    getStreamOptions(
      educationLevel,
      programChoice === OTHER_VALUE
        ? ""
        : programChoice,
    );

  const updateBalance = (balance) => {
    if (!Number.isFinite(Number(balance))) {
      return;
    }

    setUser((current) =>
      current
        ? { ...current, fluxGems: Number(balance) }
        : current,
    );
  };

  const updateContext = (key, value) => {
    setAcademicContext((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleEducationLevelChange = (
    nextEducationLevel,
  ) => {
    setAcademicContext({
      ...emptyContext,
      educationLevel: nextEducationLevel,
      programChoice:
        nextEducationLevel === "mba"
          ? "MBA"
          : nextEducationLevel === "phd"
            ? "PhD"
            : "",
    });
  };

  const handleInstitutionStateChange = (
    nextState,
  ) => {
    setAcademicContext((current) => ({
      ...current,
      institutionState: nextState,
      institutionChoice: "",
      customInstitutionName: "",
    }));
  };

  const handleInstitutionChoiceChange = (
    nextChoice,
  ) => {
    setAcademicContext((current) => ({
      ...current,
      institutionChoice: nextChoice,
      customInstitutionName: "",
    }));
  };

  const handleProgramChoiceChange = (
    nextProgram,
  ) => {
    setAcademicContext((current) => ({
      ...current,
      programChoice: nextProgram,
      customProgram: "",
      streamChoice: "",
      customStream: "",
    }));
  };

  const handleStreamChoiceChange = (
    nextStream,
  ) => {
    setAcademicContext((current) => ({
      ...current,
      streamChoice: nextStream,
      customStream: "",
    }));
  };

  const resetContext = () => {
    setAcademicContext(profileToContext(profile));
    toast.success("Academic scope reset to your saved profile.");
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose a source file smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setSourceFile(file);
  };

  const validate = () => {
    if (sourceMode === "topic" && topic.trim().length < 3) {
      toast.error("Enter a topic with at least 3 characters.");
      return false;
    }

    if (sourceMode === "source" && !sourceFile) {
      toast.error("Upload a source before continuing.");
      return false;
    }

    if (!educationLevel) {
      toast.error(
        "Choose the education level for this generation.",
      );
      return false;
    }

    if (
      !boardFlow &&
      !INDIA_STATES.includes(
        institutionState,
      )
    ) {
      toast.error(
        "Choose the state / union territory for this generation.",
      );
      return false;
    }

    if (!institutionChoice) {
      toast.error(
        boardFlow
          ? "Choose the school board used for this generation."
          : "Choose the institution used for this generation.",
      );
      return false;
    }

    if (
      boardFlow &&
      institutionChoice !== OTHER_VALUE &&
      !BOARD_OPTIONS.includes(
        institutionChoice,
      )
    ) {
      toast.error(
        "Choose a valid school board for this generation.",
      );
      return false;
    }

    if (
      institutionChoice === OTHER_VALUE &&
      academicContext.customInstitutionName
        .trim().length < 2
    ) {
      toast.error(
        boardFlow
          ? "Enter the school board name."
          : "Enter the institution name.",
      );
      return false;
    }

    if (usesProgram) {
      if (!programChoice) {
        toast.error(
          "Choose the program / degree for this generation.",
        );
        return false;
      }

      if (
        programChoice !== OTHER_VALUE &&
        !programOptions.includes(
          programChoice,
        )
      ) {
        toast.error(
          "Choose a valid program / degree.",
        );
        return false;
      }

      if (
        programChoice === OTHER_VALUE &&
        academicContext.customProgram
          .trim().length < 2
      ) {
        toast.error(
          "Enter the program / degree.",
        );
        return false;
      }
    }

    if (
      usesStream &&
      (!usesProgram || programChoice)
    ) {
      if (!streamChoice) {
        toast.error(
          "Choose the stream / specialization for this generation.",
        );
        return false;
      }

      if (
        streamChoice !== OTHER_VALUE &&
        !streamOptions.includes(
          streamChoice,
        )
      ) {
        toast.error(
          "Choose a valid stream / specialization.",
        );
        return false;
      }

      if (
        streamChoice === OTHER_VALUE &&
        academicContext.customStream
          .trim().length < 2
      ) {
        toast.error(
          "Enter the stream / specialization.",
        );
        return false;
      }
    }

    if (!hasEnoughFluxGems) {
      toast.error(`You need ${GENERATION_COST} FluxGems for this generation.`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setIsGenerating(true);

      const response = await generateStudySession({
        generationType,
        sourceMode,
        topic: topic.trim(),
        sourceFile,
        detailLevel,
        difficulty,
        quizSize: isNotes ? 0 : quizSize,
        academicContext: {
          educationLevel,
          institutionState:
            boardFlow
              ? ""
              : institutionState,
          institutionChoice,
          customInstitutionName:
            academicContext.customInstitutionName.trim(),
          programChoice:
            usesProgram
              ? programChoice
              : "",
          customProgram:
            usesProgram
              ? academicContext.customProgram.trim()
              : "",
          streamChoice:
            usesStream
              ? streamChoice
              : "",
          customStream:
            usesStream
              ? academicContext.customStream.trim()
              : "",
        },
      });

      updateBalance(response?.data?.fluxGems?.balance);

      const sessionId = response?.data?.studySession?.id;

      if (!sessionId) {
        throw new Error("The generated item ID is missing.");
      }

      toast.success(
        response.message ||
          `${isNotes ? "AI Notes" : "Quiz"} generated successfully.`,
      );

      navigate(
        isNotes
          ? `/study/${sessionId}`
          : `/study/${sessionId}?tab=quiz`,
      );
    } catch (error) {
      const responseData = error?.response?.data;

      if (responseData?.data?.balance !== undefined) {
        updateBalance(responseData.data.balance);
      }

      toast.error(getApiErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout>
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
            <p className="text-sm font-bold text-violet-600">{page.eyebrow}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
              {page.title}
            </h1>
            <p className="mt-2 max-w-3xl leading-7 text-muted">
              {page.description}
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-emerald-200/90 bg-white/72 px-4 py-3 shadow-sm backdrop-blur-xl">
          <FluxGemMark size={38} />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
              Generation cost
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
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-violet-400/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-200/80">
              <PageIcon size={22} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
                Profile defaults · temporary override
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                Adjust the academic scope for this generation.
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                These fields start from your saved learning profile. Edits here are saved only as a snapshot with this generated item and do not modify your main profile.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetContext}
            disabled={isProfileLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/78 px-4 py-2.5 text-sm font-extrabold text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-50"
          >
            <RefreshCcw size={16} />
            Reset to profile
          </button>
        </div>

        {isProfileLoading ? (
          <div className="relative mt-5 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-4 py-4 text-sm font-semibold text-slate-500 backdrop-blur">
            <LoaderCircle size={17} className="animate-spin" />
            Loading your academic defaults...
          </div>
        ) : (
          <div className="relative mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Education level
              </span>
              <select
                value={educationLevel}
                onChange={(event) =>
                  handleEducationLevelChange(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100/70"
              >
                <option value="">
                  Choose level
                </option>
                {EDUCATION_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            {!boardFlow &&
              educationLevel && (
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    State / UT
                  </span>
                  <select
                    value={institutionState}
                    onChange={(event) =>
                      handleInstitutionStateChange(
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100/70"
                  >
                    <option value="">
                      Choose state / UT
                    </option>
                    {INDIA_STATES.map(
                      (state) => (
                        <option
                          key={state}
                          value={state}
                        >
                          {state}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}

            {boardFlow &&
              educationLevel && (
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    School board
                  </span>
                  <div className="mt-2">
                    <SearchableSelect
                      options={BOARD_OPTIONS}
                      value={institutionChoice}
                      onChange={
                        handleInstitutionChoiceChange
                      }
                      placeholder="Search or select your board"
                    />
                  </div>
                </label>
              )}

            {!boardFlow &&
              institutionState && (
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    {educationLevel ===
                    "diploma"
                      ? "Diploma institution"
                      : "University / College / Institute"}
                  </span>
                  <div className="mt-2">
                    <InstitutionSearchSelect
                      institutions={
                        institutionOptions
                      }
                      value={institutionChoice}
                      onChange={
                        handleInstitutionChoiceChange
                      }
                      placeholder={
                        educationLevel ===
                        "diploma"
                          ? "Search diploma institutions"
                          : "Search universities, colleges and institutes"
                      }
                    />
                  </div>
                </label>
              )}

            {institutionChoice ===
              OTHER_VALUE && (
                <CustomContextInput
                  label={
                    boardFlow
                      ? "Enter school board"
                      : "Enter institution name"
                  }
                  value={
                    academicContext.customInstitutionName
                  }
                  onChange={(value) =>
                    updateContext(
                      "customInstitutionName",
                      value,
                    )
                  }
                  placeholder={
                    boardFlow
                      ? "School board name"
                      : "Institution name"
                  }
                />
              )}

            {usesProgram && (
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                  Program / Degree
                </span>
                <select
                  value={programChoice}
                  onChange={(event) =>
                    handleProgramChoiceChange(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100/70"
                >
                  <option value="">
                    Choose program / degree
                  </option>
                  {programOptions.map(
                    (program) => (
                      <option
                        key={program}
                        value={program}
                      >
                        {program}
                      </option>
                    ),
                  )}
                  <option value={OTHER_VALUE}>
                    Other / Not listed
                  </option>
                </select>
              </label>
            )}

            {programChoice ===
              OTHER_VALUE && (
                <CustomContextInput
                  label="Enter program / degree"
                  value={
                    academicContext.customProgram
                  }
                  onChange={(value) =>
                    updateContext(
                      "customProgram",
                      value,
                    )
                  }
                  placeholder="Program / degree"
                />
              )}

            {usesStream &&
              (!usesProgram ||
                programChoice) && (
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    {["class_11", "class_12"].includes(
                      educationLevel,
                    )
                      ? "Stream"
                      : "Stream / Specialization"}
                  </span>
                  <select
                    value={streamChoice}
                    onChange={(event) =>
                      handleStreamChoiceChange(
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100/70"
                  >
                    <option value="">
                      Choose stream / specialization
                    </option>
                    {streamOptions.map(
                      (stream) => (
                        <option
                          key={stream}
                          value={stream}
                        >
                          {stream}
                        </option>
                      ),
                    )}
                    <option value={OTHER_VALUE}>
                      Other / Not listed
                    </option>
                  </select>
                </label>
              )}

            {streamChoice ===
              OTHER_VALUE && (
                <CustomContextInput
                  label="Enter stream / specialization"
                  value={
                    academicContext.customStream
                  }
                  onChange={(value) =>
                    updateContext(
                      "customStream",
                      value,
                    )
                  }
                  placeholder="Stream / specialization"
                />
              )}

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/55 p-4">
              <div className="flex items-start gap-3">
                <GraduationCap
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
                <div>
                  <p className="text-sm font-extrabold text-emerald-900">
                    Historical snapshot
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800/80">
                    The same controlled profile choices are used here. The
                    normalized result is stored with this generated item, so
                    later profile changes cannot rewrite its history.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(330px,0.72fr)]"
      >
        <div className="space-y-5">
          <article className="rounded-3xl border border-indigo-200/90 bg-white/70 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-600">1. Choose your source</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  What should the {isNotes ? "notes" : "quiz"} cover?
                </h2>
              </div>

              <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
                {["topic", "source"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSourceMode(mode)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
                      sourceMode === mode
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {mode === "source" ? "Upload" : "Topic"}
                  </button>
                ))}
              </div>
            </div>

            {sourceMode === "topic" ? (
              <div className="mt-5">
                <label htmlFor={`${generationType}-topic`} className="text-sm font-bold text-slate-700">
                  Topic
                </label>
                <textarea
                  id={`${generationType}-topic`}
                  value={topic}
                  maxLength={180}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={5}
                  placeholder={
                    isNotes
                      ? "Example: Explain database normalization from 1NF through 3NF with practical examples"
                      : "Example: Test me on database normalization, functional dependencies and 1NF through 3NF"
                  }
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">Be specific for more focused output.</p>
                  <p className="text-xs font-bold text-slate-400">{topic.length}/180</p>
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
                      <p className="truncate text-sm font-extrabold text-slate-900">{sourceFile.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {(sourceFile.size / 1024 / 1024).toFixed(2)} MB ready to use
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSourceFile(null)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-rose-600"
                      aria-label="Remove source file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/35 px-6 py-10 text-center transition hover:border-indigo-300 hover:bg-indigo-50/60">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:-translate-y-0.5">
                      <Upload size={21} />
                    </div>
                    <p className="mt-4 font-extrabold text-slate-900">Upload study material</p>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
                      PDF, TXT or Markdown. The generated {isNotes ? "notes" : "quiz"} will be grounded in this source.
                    </p>
                    <span className="mt-3 text-xs font-bold text-indigo-600">Maximum 10 MB</span>
                  </label>
                )}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-cyan-200/90 bg-white/70 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <p className="text-sm font-bold text-cyan-700">2. Shape the output</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              {isNotes ? "Choose notes depth" : "Choose quiz settings"}
            </h2>

            {isNotes ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {DETAIL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDetailLevel(option.value)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      detailLevel === option.value
                        ? "border-violet-300 bg-violet-50/80 shadow-sm"
                        : "border-slate-200 bg-white/70 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-900">{option.label}</span>
                      {detailLevel === option.value && (
                        <CheckCircle2 size={17} className="text-violet-600" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{option.helper}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="standalone-difficulty" className="text-sm font-bold text-slate-700">
                    Quiz difficulty
                  </label>
                  <select
                    id="standalone-difficulty"
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-700">Quiz length</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {QUIZ_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuizSize(count)}
                        className={`rounded-2xl border px-3 py-3 text-sm font-extrabold transition ${
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
            )}
          </article>
        </div>

        <aside>
          <article className="sticky top-[100px] rounded-3xl border border-emerald-300/90 bg-gradient-to-br from-emerald-100/92 via-cyan-50/78 to-violet-50/70 p-5 shadow-[0_18px_44px_rgba(16,185,129,0.12)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-700">Generation preview</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-950">{page.previewTitle}</h2>
              </div>
              <FluxGemMark size={44} />
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/68 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <PageIcon size={18} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {isNotes ? "No quiz generated" : "No notes generated"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    This standalone tool does exactly one job and costs half of the combined 50-Gem session.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/68 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                  <BookOpenCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Saved to Study Library</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    The output, academic-context snapshot, generation settings and quiz attempts (when applicable) remain recoverable in history.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-white/72 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-slate-600">Generation cost</span>
                <span className="text-sm font-extrabold text-emerald-700">{GENERATION_COST} FluxGems</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Gems are reserved before the AI request and automatically refunded if both Gemini models fail.
              </p>
            </div>

            <button
              type="submit"
              disabled={isGenerating || isProfileLoading || !hasEnoughFluxGems}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200/70 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isGenerating ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {isGenerating ? "Generating..." : page.action}
            </button>

            {!hasEnoughFluxGems && (
              <p className="mt-3 text-center text-xs font-bold text-rose-600">
                You need {GENERATION_COST - fluxGems} more FluxGems.
              </p>
            )}
          </article>
        </aside>
      </form>
    </DashboardLayout>
  );
}

export default StandaloneGeneratorWorkspace;
