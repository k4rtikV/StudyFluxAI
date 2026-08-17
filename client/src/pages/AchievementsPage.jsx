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
import DashboardLayout from "../layouts/DashboardLayout";
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
        description: "Complete your first Daily Challenge.",
      },
    ],
  },
];

function AchievementsPage() {
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        const response = await getProgressOverview();

        if (active) {
          setOverview(response?.data || null);
        }
      } catch (error) {
        if (active) {
          toast.error(
            error?.response?.data?.message ||
              "Your achievement progress could not be loaded.",
          );
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
    <DashboardLayout>
      <section>
        <p className="text-sm font-bold text-violet-600">
          Progression
        </p>

        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
          Achievements
        </h1>

        <p className="mt-2 max-w-3xl leading-7 text-muted">
          Achievement progress now follows your saved learning sessions,
          quiz results and study streak instead of placeholder values.
        </p>
      </section>

      {isLoading ? (
        <div className="mt-7 flex min-h-[45vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" />
            Loading progression...
          </div>
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Medal size={20} />
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Unlocked
              </p>

              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {Number(stats.unlockedCount || 0)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Zap size={20} />
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Achievement XP
              </p>

              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {Number(stats.achievementXp || 0)} XP
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/50 to-violet-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <FluxGemMark size={40} />

                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    Gem rewards earned
                  </p>

                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    {Number(stats.gemRewardsEarned || 0)}
                  </p>
                </div>
              </div>
            </article>
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
                    <div
                      className={`grid h-11 w-11 place-items-center rounded-2xl ${group.accent}`}
                    >
                      <Icon size={21} />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-brand-600">
                        Achievement category
                      </p>

                      <h2 className="text-xl font-extrabold text-slate-900">
                        {group.title}
                      </h2>
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
                                progress.unlocked
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {progress.unlocked ? (
                                <CheckCircle2 size={17} />
                              ) : (
                                <LockKeyhole size={17} />
                              )}
                            </div>

                            <span
                              className={`text-xs font-bold ${
                                progress.unlocked
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {progress.current} / {progress.target}
                            </span>
                          </div>

                          <h3 className="mt-4 font-extrabold text-slate-800">
                            {item.title}
                          </h3>

                          <p className="mt-1.5 text-sm leading-6 text-slate-500">
                            {item.description}
                          </p>

                          <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-400">
                              {progress.unlocked ? "Unlocked" : "In progress"}
                            </span>
                            <span className="text-amber-600">
                              {progress.xpReward} XP
                            </span>
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
              <Sparkles
                size={20}
                className="mt-0.5 shrink-0 text-violet-600"
              />

              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Progress is based on saved activity
                </h2>

                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                  Generated sessions, completed Tutor questions and Daily Challenge attempts
                  contribute to learning streaks. Streak days are calculated in your saved
                  timezone ({stats.streakTimeZone || "UTC"}) so activity around midnight
                  follows your local calendar instead of UTC.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}

export default AchievementsPage;
