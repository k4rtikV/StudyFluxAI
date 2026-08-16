import {
  Award,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  Flame,
  Gem,
  LockKeyhole,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import DashboardLayout from "../layouts/DashboardLayout";

const ACHIEVEMENT_GROUPS = [
  {
    title: "Learning milestones",
    icon: Target,
    accent: "bg-brand-50 text-brand-600",
    items: [
      {
        title: "First Step",
        description: "Complete your first StudyFluxAI learning session.",
        progress: "0 / 1",
      },
      {
        title: "Quiz Starter",
        description: "Complete your first generated quiz.",
        progress: "0 / 1",
      },
      {
        title: "Focused Learner",
        description: "Complete 10 learning sessions.",
        progress: "0 / 10",
      },
    ],
  },
  {
    title: "Consistency",
    icon: Flame,
    accent: "bg-orange-50 text-orange-600",
    items: [
      {
        title: "Three-Day Spark",
        description: "Maintain a 3-day learning streak.",
        progress: "0 / 3",
      },
      {
        title: "One-Week Streak",
        description: "Maintain a 7-day learning streak.",
        progress: "0 / 7",
      },
      {
        title: "Consistency Champion",
        description: "Maintain a 30-day learning streak.",
        progress: "0 / 30",
      },
    ],
  },
  {
    title: "Performance",
    icon: Trophy,
    accent: "bg-emerald-50 text-emerald-600",
    items: [
      {
        title: "Sharp Mind",
        description: "Score 80% or higher on an eligible quiz.",
        progress: "0 / 1",
      },
      {
        title: "Near Perfect",
        description: "Score 90% or higher on an eligible quiz.",
        progress: "0 / 1",
      },
      {
        title: "Challenge Winner",
        description: "Complete your first Daily Challenge.",
        progress: "0 / 1",
      },
    ],
  },
];

function AchievementsPage() {
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
          Achievements recognize meaningful milestones across
          learning, consistency, quiz performance and community
          participation. Selected achievements can also reward
          XP or FluxGems.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Medal size={20} />
          </div>

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Unlocked
          </p>

          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            0
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
            0 XP
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
                0
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-7 space-y-6">
        {ACHIEVEMENT_GROUPS.map((group) => {
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
                {group.items.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-400 shadow-sm">
                        <LockKeyhole size={17} />
                      </div>

                      <span className="text-xs font-bold text-slate-400">
                        {item.progress}
                      </span>
                    </div>

                    <h3 className="mt-4 font-extrabold text-slate-800">
                      {item.title}
                    </h3>

                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
                      <div className="h-full w-0 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500" />
                    </div>
                  </div>
                ))}
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
              More achievements will unlock as StudyFluxAI grows
            </h2>

            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
              Weekly challenges, leaderboard milestones, topic mastery,
              study-planner consistency and community participation can
              all feed into the achievement system later.
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default AchievementsPage;