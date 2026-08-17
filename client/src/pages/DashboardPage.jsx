import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Flame,
  Gauge,
  GraduationCap,
  Lightbulb,
  LockKeyhole,
  NotebookPen,
  Play,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import { getProgressOverview } from "../services/progressService";

const QUICK_ACTIONS = [
  {
    title: "AI Notes",
    description:
      "Turn a topic into focused, structured study notes.",
    icon: NotebookPen,
    accent:
      "bg-brand-50 text-brand-600",
    border:
      "border-indigo-200/90 hover:border-indigo-300",
    path: "/generate/notes",
  },
  {
    title: "Quiz Generator",
    description:
      "Create practice questions matched to your level.",
    icon: Lightbulb,
    accent:
      "bg-violet-50 text-violet-600",
    border:
      "border-violet-200/90 hover:border-violet-300",
    path: "/generate/quiz",
  },
  {
    title: "AI Tutor",
    description:
      "Ask questions and learn through guided explanations.",
    icon: BrainCircuit,
    accent:
      "bg-cyan-50 text-cyan-600",
    border:
      "border-cyan-200/90 hover:border-cyan-300",
    path: "/ai-tutor",
    actionLabel: "Open AI Tutor",
  },
  {
    title: "Study Planner",
    description:
      "Organize upcoming learning goals and sessions.",
    icon: CalendarDays,
    accent:
      "bg-emerald-50 text-emerald-600",
    border:
      "border-emerald-200/90 hover:border-emerald-300",
  },
];

function MetricCard({
  icon: Icon,
  iconClass,
  label,
  value,
  helper,
  children,
}) {
  const cardClass =
    label === "Current level"
      ? "border-indigo-200/90 hover:border-indigo-300"
      : label === "XP"
        ? "border-amber-200/90 hover:border-amber-300"
        : label === "FluxGems"
          ? "border-cyan-200/90 hover:border-cyan-300"
          : "border-emerald-200/90 hover:border-emerald-300";

  return (
    <div className={`rounded-2xl border bg-white/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/86 hover:shadow-[0_18px_38px_rgba(15,23,42,0.10)] ${cardClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        {children || (
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl ${iconClass}`}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();

  const {
    user,
  } = useAuth();

  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      try {
        const response = await getProgressOverview();

        if (active) {
          setProgress(response?.data || null);
        }
      } catch {
        // Keep the dashboard usable if progression data is temporarily unavailable.
      }
    };

    loadProgress();

    return () => {
      active = false;
    };
  }, []);

  const stats = progress?.stats || {};
  const achievements = progress?.achievements || {};
  const achievementXp = Number(stats.achievementXp || 0);
  const currentLevel = Math.floor(achievementXp / 500) + 1;
  const recentSessions = progress?.recentSessions || [];
  const recentTutorConversations =
    progress?.recentTutorConversations || [];

  const recentActivity = useMemo(
    () =>
      [
        ...recentSessions.map((session) => ({
          ...session,
          activityType: "study",
          activityAt:
            session.completedAt ||
            session.createdAt,
        })),
        ...recentTutorConversations.map((conversation) => ({
          ...conversation,
          activityType: "tutor",
          activityAt:
            conversation.lastMessageAt ||
            conversation.createdAt,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.activityAt || 0) -
            new Date(a.activityAt || 0),
        )
        .slice(0, 4),
    [recentSessions, recentTutorConversations],
  );

  const milestones = useMemo(
    () => [
      {
        title: "Generate your first learning session",
        progress: achievements.first_step,
      },
      {
        title: "Build a 3-day learning streak",
        progress: achievements.three_day_spark,
      },
      {
        title: "Complete your first generated quiz",
        progress: achievements.quiz_starter,
      },
    ],
    [achievements],
  );

  const firstName =
    user?.fullName?.split(" ")[0] ||
    "there";

  const showComingSoon = (
    feature,
  ) => {
    toast(
      `${feature} will be connected in an upcoming StudyFluxAI phase.`,
    );
  };

  return (
    <DashboardLayout>
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-600">
            Good to see you, {firstName} 👋
          </p>

          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Your learning dashboard
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Study smarter, build consistency and
            turn progress into momentum.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/generate")
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 sm:w-auto"
        >
          <Sparkles size={18} />
          Start learning
        </button>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Gauge}
          iconClass="bg-brand-50 text-brand-600"
          label="Current level"
          value={`Level ${currentLevel}`}
          helper="Level currently reflects achievement XP."
        />

        <MetricCard
          icon={Zap}
          iconClass="bg-amber-50 text-amber-600"
          label="XP"
          value={`${achievementXp} XP`}
          helper="Earn XP by unlocking learning achievements."
        />

        <MetricCard
          label="FluxGems"
          value={String(Number(user?.fluxGems || 0))}
          helper="Emerald-led rewards with cyan and violet accents."
        >
          <FluxGemMark size={42} />
        </MetricCard>

        <MetricCard
          icon={Flame}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Learning streak"
          value={`${Number(stats.currentStreak || 0)} days`}
          helper="Complete learning activity on consecutive days."
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="group relative overflow-hidden rounded-3xl border border-violet-300/80 bg-gradient-to-br from-indigo-100/95 via-violet-100/82 to-cyan-50/82 p-6 shadow-[0_18px_46px_rgba(109,40,217,0.14)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-400 hover:shadow-[0_26px_56px_rgba(109,40,217,0.21)] sm:p-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 via-violet-500 to-emerald-400" />

          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-400/45 blur-3xl transition-transform duration-500 group-hover:scale-110" />
          <div className="pointer-events-none absolute -bottom-24 left-[42%] h-60 w-60 rounded-full bg-cyan-300/35 blur-3xl transition-transform duration-500 group-hover:scale-110" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-indigo-300/34 blur-3xl" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-100/75 px-3 py-1.5 text-xs font-extrabold text-indigo-700 shadow-sm backdrop-blur">
                <GraduationCap size={14} />
                Personalized learning
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-100/75 px-3 py-1.5 text-xs font-extrabold text-emerald-700 shadow-sm backdrop-blur">
                <CheckCircle2 size={14} />
                Profile ready
              </span>
            </div>

            <div className="mt-6 flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-lg shadow-indigo-200/70 sm:grid">
                <Sparkles size={22} />
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-violet-600">
                  Your smart learning launchpad
                </p>

                <h2 className="mt-2 max-w-2xl text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                  Turn any topic into your next
                  learning session.
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              StudyFluxAI uses your learning profile to
              shape notes, quizzes and tutor explanations
              around the right level, program and field of study.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-violet-200/80 bg-white/70 px-3 py-1.5 text-violet-700 backdrop-blur">
                Notes
              </span>

              <span className="rounded-full border border-cyan-200/80 bg-white/70 px-3 py-1.5 text-cyan-700 backdrop-blur">
                Quiz
              </span>

              <span className="rounded-full border border-emerald-200/80 bg-white/70 px-3 py-1.5 text-emerald-700 backdrop-blur">
                AI Tutor
              </span>

              <span className="rounded-full border border-indigo-200/80 bg-white/70 px-3 py-1.5 text-indigo-700 backdrop-blur">
                Progress
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  navigate("/generate")
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-200/80"
              >
                <Play size={17} />
                Create a study session
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/library")
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200/90 bg-white/72 px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:text-indigo-700"
              >
                <BookOpenCheck size={17} />
                Open library
              </button>
            </div>
          </div>
        </article>

        <article className="group relative overflow-hidden rounded-3xl border border-emerald-300/85 bg-gradient-to-br from-emerald-100/95 via-emerald-50/86 to-cyan-50/78 p-6 shadow-[0_18px_44px_rgba(16,185,129,0.14)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-[0_26px_54px_rgba(16,185,129,0.20)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/42 blur-3xl transition-transform duration-500 group-hover:scale-110" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-cyan-300/26 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white shadow-sm">
              <Trophy size={21} />
            </div>

            <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
              Daily Challenge
            </span>
          </div>

          <p className="relative mt-6 text-sm font-bold text-emerald-700">
            Challenge system incoming
          </p>

          <h3 className="relative mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            A fresh quiz every day.
          </h3>

          <p className="relative mt-3 leading-7 text-slate-600">
            Vote on the topic, take the winning
            Gemini-generated quiz and earn XP plus
            FluxGems.
          </p>

          <button
            type="button"
            onClick={() =>
              showComingSoon(
                "Daily Challenges",
              )
            }
            className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-900"
          >
            Preview challenge flow
            <ArrowRight size={16} />
          </button>
        </article>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand-600">
              Quick actions
            </p>

            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              What do you want to do?
            </h2>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map(
            ({
              title,
              description,
              icon: Icon,
              accent,
              border,
              path,
              actionLabel,
            }) => (
              <button
                key={title}
                type="button"
                onClick={() =>
                  path
                    ? navigate(path)
                    : showComingSoon(title)
                }
                className={`group rounded-2xl border bg-white/68 p-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/86 hover:shadow-[0_18px_38px_rgba(15,23,42,0.10)] ${border}`}
              >
                <div
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${accent}`}
                >
                  <Icon size={21} />
                </div>

                <h3 className="mt-5 text-base font-extrabold text-slate-900">
                  {title}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {description}
                </p>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-400 transition group-hover:text-brand-600">
                  {path
                    ? actionLabel || "Open generator"
                    : "Coming soon"}
                  <ArrowRight size={14} />
                </div>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <article className="rounded-3xl border border-sky-200/90 bg-white/68 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-300 hover:bg-white/84 hover:shadow-[0_18px_40px_rgba(14,165,233,0.10)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-brand-600">
                Recent activity
              </p>

              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                Your learning history
              </h2>
            </div>

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-400">
              <Target size={19} />
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <div className="mt-6 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/80 bg-white/40 px-5 text-center backdrop-blur-md">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <BookOpenCheck size={22} />
              </div>

              <h3 className="mt-4 font-extrabold text-slate-800">
                Nothing here yet
              </h3>

              <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                Your generated notes, completed quizzes
                and tutor sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentActivity.map((item) => (
                <button
                  key={`${item.activityType}-${item.id}`}
                  type="button"
                  onClick={() =>
                    navigate(
                      item.activityType === "tutor"
                        ? `/ai-tutor?conversation=${item.id}`
                        : `/study/${item.id}`,
                    )
                  }
                  className="group/session flex w-full items-center gap-3 rounded-2xl border border-white/80 bg-white/52 p-4 text-left backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/78"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      item.activityType === "tutor"
                        ? "bg-cyan-50 text-cyan-600"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {item.activityType === "tutor" ? (
                      <BrainCircuit size={18} />
                    ) : (
                      <BookOpenCheck size={18} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-800">
                      {item.title}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.activityType === "tutor"
                        ? `AI Tutor · ${item.successfulQuestionCount} question${
                            item.successfulQuestionCount === 1 ? "" : "s"
                          }`
                        : item.generationType === "notes"
                          ? "AI Notes · saved to library"
                          : item.quizAttempts > 0
                            ? `Quiz ${item.latestQuizScore}/${item.latestQuizTotal}`
                            : item.generationType === "combined"
                              ? "Notes + quiz · saved to library"
                              : `${item.quizSize} question quiz waiting`}
                    </p>
                  </div>

                  <ArrowRight
                    size={16}
                    className="shrink-0 text-slate-300 transition group-hover/session:text-indigo-500"
                  />
                </button>
              ))}

              <button
                type="button"
                onClick={() => navigate("/library")}
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-indigo-600 hover:text-indigo-800"
              >
                View full library
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-violet-200/90 bg-white/68 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:bg-white/84 hover:shadow-[0_18px_40px_rgba(139,92,246,0.10)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <LockKeyhole size={19} />
            </div>

            <div>
              <p className="text-sm font-bold text-violet-600">
                Progression
              </p>

              <h2 className="text-xl font-extrabold text-slate-900">
                Next milestones
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {milestones.map(({ title, progress: itemProgress }) => {
              const current = Number(itemProgress?.current || 0);
              const target = Math.max(
                Number(itemProgress?.target || 1),
                1,
              );
              const percent = Math.min((current / target) * 100, 100);

              return (
                <div
                  key={title}
                  className="rounded-2xl border border-white/70 bg-white/44 p-4 backdrop-blur-md transition-all duration-200 hover:border-white hover:bg-white/64"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-700">
                      {title}
                    </p>

                    <span className="shrink-0 text-xs font-bold text-slate-400">
                      {current} / {target}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}

export default DashboardPage;