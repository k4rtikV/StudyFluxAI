import {
  CheckCircle2,
  Flame,
  LoaderCircle,
  LockKeyhole,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import LevelKite from "../components/progression/LevelKite";
import useAuth from "../hooks/useAuth";
import { getProgressOverview } from "../services/progressService";

const ACHIEVEMENT_GROUPS = [
  {
    title: "Learning milestones",
    icon: Target,
    accent: "bg-brand-50 text-brand-600",
    items: [
      {
        key: "first_step",
        title: "First Step",
        description: "Generate your first StudyFluxAI learning session.",
      },
      {
        key: "quiz_starter",
        title: "Quiz Starter",
        description: "Complete your first generated quiz.",
      },
      {
        key: "focused_learner",
        title: "Focused Learner",
        description: "Create 10 learning sessions.",
      },
    ],
  },
  {
    title: "Consistency",
    icon: Flame,
    accent: "bg-orange-50 text-orange-600",
    items: [
      {
        key: "three_day_spark",
        title: "Three-Day Spark",
        description: "Maintain a 3-day learning streak.",
      },
      {
        key: "one_week_streak",
        title: "One-Week Streak",
        description: "Maintain a 7-day learning streak.",
      },
      {
        key: "consistency_champion",
        title: "Consistency Champion",
        description: "Maintain a 30-day learning streak.",
      },
    ],
  },
  {
    title: "Performance",
    icon: Trophy,
    accent: "bg-emerald-50 text-emerald-600",
    items: [
      {
        key: "sharp_mind",
        title: "Sharp Mind",
        description: "Score 80% or higher on a generated quiz.",
      },
      {
        key: "near_perfect",
        title: "Near Perfect",
        description: "Score 90% or higher on a generated quiz.",
      },
      {
        key: "challenge_winner",
        title: "Challenge Winner",
        description: "Answer a Daily Challenge correctly.",
      },
    ],
  },
  {
    title: "Smart Interview",
    icon: Sparkles,
    accent: "bg-cyan-50 text-cyan-700",
    items: [
      {
        key: "first_interview",
        title: "First Interview",
        description: "Complete your first Smart Interview.",
      },
      {
        key: "interview_five",
        title: "Interview Regular",
        description: "Complete 5 Smart Interviews.",
      },
      {
        key: "interview_ten",
        title: "Interview Veteran",
        description: "Complete 10 Smart Interviews.",
      },
      {
        key: "interview_variety",
        title: "Well Rounded",
        description: "Complete 3 different Smart Interview types.",
      },
      {
        key: "role_rehearsal",
        title: "Role Rehearsal",
        description: "Practice the same target role across 3 completed interviews.",
      },
      {
        key: "interview_improver",
        title: "Clear Improvement",
        description: "Improve your overall score by 10+ points on the same role and interview type.",
      },
    ],
  },
];

function AchievementsPage() {
  const { setUser } = useAuth();
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        const response = await getProgressOverview();

        if (active) {
          const nextOverview = response?.data || null;
          setOverview(nextOverview);
          setLoadError("");
          const nextBalance = Number(nextOverview?.progression?.fluxGemsBalance);
          if (Number.isFinite(nextBalance)) {
            setUser((current) =>
              current ? { ...current, fluxGems: nextBalance } : current,
            );
          }
        }
      } catch (error) {
        if (active) {
          const message =
            error?.response?.data?.message ||
            "Your achievement progress could not be loaded.";
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, []);

  const stats = overview?.stats || {};
  const achievements = overview?.achievements || {};
  const progression = overview?.progression || {};
  const level = Number(progression.level || stats.level || 1);
  const totalXp = Number(stats.totalXp || 0);
  const quizMilestones = Array.isArray(progression.quizMilestones)
    ? progression.quizMilestones
    : [];
  const smartInterviewRule = progression.smartInterview || {};

  const groups = useMemo(
    () =>
      ACHIEVEMENT_GROUPS.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          progress: achievements[item.key] || {
            current: 0,
            target: 1,
            unlocked: false,
            xpReward: 0,
          },
        })),
      })),
    [achievements],
  );

  return (
    <>
      <section>
        <p className="text-sm font-bold text-violet-600">Progression</p>

        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
          Levels & achievements
        </h1>

        <p className="mt-2 max-w-3xl leading-7 text-muted">
          XP is earned from real learning activity, moves your level forward and
          powers the XP leaderboards. FluxGems remain a separate spendable currency.
        </p>
      </section>

      {isLoading ? (
        <div className="mt-7 flex min-h-[45vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" />
            Loading progression...
          </div>
        </div>
      ) : loadError && !overview ? (
        <section className="mt-7 grid min-h-[320px] place-items-center rounded-3xl border border-amber-200 bg-amber-50/45 p-8 text-center">
          <div>
            <Zap className="mx-auto text-amber-500" size={34} />
            <h2 className="mt-4 text-xl font-black text-slate-950">Progression temporarily unavailable</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{loadError}</p>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-6 overflow-hidden rounded-[30px] border border-violet-200/80 bg-gradient-to-br from-violet-100/90 via-white to-cyan-50/80 p-6 shadow-[0_20px_50px_rgba(91,33,182,0.08)] sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
              <LevelKite level={level} size={92} />

              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                  Your level
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-3xl font-black text-slate-950">Level {level}</h2>
                  <span className="text-sm font-bold text-slate-500">
                    {totalXp.toLocaleString()} lifetime XP
                  </span>
                </div>

                <div className="mt-4 max-w-2xl">
                  <div className="flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="text-slate-600">
                      {progression.isMaxLevel
                        ? "Current level cap"
                        : `Toward Level ${Number(
                            progression.nextLevel ||
                              Math.min(level + 1, Number(progression.maxLevel || 12)),
                          )}`}
                    </span>
                    <span className="text-violet-700">
                      {progression.isMaxLevel
                        ? "MAX LEVEL"
                        : `${Number(progression.xpIntoLevel || 0).toLocaleString()} / ${Number(progression.xpForLevel || 0).toLocaleString()} XP`}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white ring-1 ring-violet-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(Math.max(Number(progression.progressPercent || 0), 0), 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {progression.isMaxLevel
                      ? `Level ${Number(progression.maxLevel || 12)} is the current StudyFluxAI progression cap.`
                      : `${Number(progression.xpToNextLevel || 0).toLocaleString()} XP remaining. Your lifetime XP total never resets between levels.`}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/90 bg-white/75 px-4 py-3 text-left shadow-sm lg:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  Level range
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">1–{Number(progression.maxLevel || 12)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Rising XP thresholds</p>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Medal size={20} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">Unlocked achievements</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {Number(stats.unlockedCount || 0)} / {Object.keys(achievements).length}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Zap size={20} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">Lifetime XP</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {totalXp.toLocaleString()} XP
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Trophy size={20} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">Achievement XP</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {Number(stats.achievementXp || 0).toLocaleString()} XP
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/50 to-violet-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <FluxGemMark size={40} />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Gem rewards earned</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    {Number(stats.gemRewardsEarned || 0)}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-7 rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/80 via-white to-violet-50/55 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-cyan-700">XP rules</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">How you earn progression XP</h2>
              </div>
              <span className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-violet-700">
                XP cannot be purchased
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quizMilestones.map((milestone) => (
                <div key={milestone.key} className="rounded-2xl border border-white bg-white/78 p-4 shadow-sm">
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-violet-600">Generated quiz</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{milestone.label}</p>
                  <p className="mt-3 text-xl font-black text-amber-600">+{milestone.xp} XP</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Once per generated quiz.</p>
                </div>
              ))}

              <div className="rounded-2xl border border-white bg-white/78 p-4 shadow-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-emerald-600">Daily Challenge</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Answer the live challenge correctly.</p>
                <p className="mt-3 text-xl font-black text-amber-600">Configured XP</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">The reward shown on that day&apos;s challenge is ledger-backed.</p>
              </div>

              <div className="rounded-2xl border border-white bg-white/78 p-4 shadow-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-cyan-700">Smart Interview</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Complete a full adaptive mock interview.</p>
                <p className="mt-3 text-xl font-black text-amber-600">+{Number(smartInterviewRule.completionXp || 75)} XP</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">Completion XP is awarded only for your first completed interview per learner-local day. Achievement XP remains one-time and separate.</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Quiz milestones stack when you qualify, but each milestone can only be earned once for that generated quiz. Retakes can unlock a higher score milestone later, but cannot farm a milestone you already earned.
            </p>
          </section>

          <section className="mt-7 space-y-6">
            {groups.map((group) => {
              const Icon = group.icon;

              return (
                <article
                  key={group.title}
                  className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-2xl ${group.accent}`}>
                      <Icon size={21} />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-brand-600">Achievement category</p>
                      <h2 className="text-xl font-extrabold text-slate-900">{group.title}</h2>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {group.items.map((item) => {
                      const progress = item.progress;
                      const percent = Math.min(
                        (Number(progress.current || 0) /
                          Math.max(Number(progress.target || 1), 1)) *
                          100,
                        100,
                      );

                      return (
                        <div
                          key={item.key}
                          className={`rounded-2xl border p-4 transition ${
                            progress.unlocked
                              ? "border-emerald-200 bg-emerald-50/55"
                              : "border-slate-100 bg-slate-50/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm ${
                                progress.unlocked ? "text-emerald-600" : "text-slate-400"
                              }`}
                            >
                              {progress.unlocked ? <CheckCircle2 size={17} /> : <LockKeyhole size={17} />}
                            </div>

                            <span
                              className={`text-xs font-bold ${
                                progress.unlocked ? "text-emerald-700" : "text-slate-400"
                              }`}
                            >
                              {progress.current} / {progress.target}
                            </span>
                          </div>

                          <h3 className="mt-4 font-extrabold text-slate-800">{item.title}</h3>
                          <p className="mt-1.5 text-sm leading-6 text-slate-500">{item.description}</p>

                          <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                            <span className={progress.unlocked ? "text-emerald-700" : "text-slate-400"}>
                              {progress.unlocked ? "Unlocked · XP credited" : "In progress"}
                            </span>
                            <span className="text-amber-600">+{progress.xpReward} XP</span>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mt-6 rounded-3xl border border-violet-200/80 bg-violet-50/60 p-6">
            <div className="flex items-start gap-3">
              <Sparkles size={20} className="mt-0.5 shrink-0 text-violet-600" />
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Progress comes from saved activity</h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                  Generated quiz results, Smart Interview completions, achievement unlocks and correct Daily Challenge answers are stored in the XP ledger. Learning sessions, Tutor questions, completed Smart Interviews and Daily Challenge participation also contribute to streaks. Streak days and Smart Interview daily-XP protection use your saved timezone ({stats.streakTimeZone || "UTC"}).
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default AchievementsPage;
