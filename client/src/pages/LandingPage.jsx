import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarCheck2,
  BrainCircuit,
  CheckCircle2,
  Coins,
  FileText,
  GraduationCap,
  Layers3,
  LockKeyhole,
  MessageCircleQuestion,
  NotebookPen,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const FEATURES = [
  {
    icon: NotebookPen,
    title: "AI Notes",
    description:
      "Turn a topic into structured, learner-aware notes built around your academic profile.",
    accent: "violet",
  },
  {
    icon: Target,
    title: "AI Quiz",
    description:
      "Generate focused quizzes, save attempts and revisit results from your Study Library.",
    accent: "cyan",
  },
  {
    icon: Layers3,
    title: "Study Sessions",
    description:
      "Create notes and a quiz together for one complete revision workflow.",
    accent: "emerald",
  },
  {
    icon: BrainCircuit,
    title: "AI Tutor",
    description:
      "Ask follow-up questions inside persistent tutor conversations when a topic needs more clarity.",
    accent: "violet",
  },
  {
    icon: CalendarCheck2,
    title: "Study Planner",
    description:
      "Schedule study goals, reschedule work and jump straight into related material from your Study Library.",
    accent: "emerald",
  },
  {
    icon: BriefcaseBusiness,
    title: "Smart Interview",
    description:
      "Practice adaptive voice interviews with Astra, review detailed reports and send the full question stack to AI Tutor.",
    accent: "violet",
  },
  {
    icon: Trophy,
    title: "Challenges & Leaderboards",
    description:
      "Take on daily challenges, earn progress and compare learning activity on live leaderboards.",
    accent: "cyan",
  },
  {
    icon: Coins,
    title: "FluxGems Economy",
    description:
      "Use a transparent in-app learning currency for AI generation and supported reward flows.",
    accent: "emerald",
  },
];

const FEATURE_ACCENTS = {
  violet:
    "border-violet-200/70 bg-violet-50/80 text-violet-700 group-hover:border-violet-300",
  cyan:
    "border-cyan-200/70 bg-cyan-50/80 text-cyan-700 group-hover:border-cyan-300",
  emerald:
    "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 group-hover:border-emerald-300",
};

const WORKFLOW = [
  {
    step: "01",
    title: "Set your learning profile",
    description:
      "StudyFluxAI can adapt generation to your education level, board or university and stream while keeping interview profile scope optional.",
  },
  {
    step: "02",
    title: "Generate and organize",
    description:
      "Create AI Notes, AI Quizzes or combined Study Sessions, then schedule goals in Study Planner and reopen everything from Study Library.",
  },
  {
    step: "03",
    title: "Learn with an AI Tutor",
    description:
      "Use persistent Tutor conversations for follow-ups, explanations and deep dives connected to saved learning material.",
  },
  {
    step: "04",
    title: "Practice and prove progress",
    description:
      "Run adaptive Smart Interviews, complete daily challenges and build XP, level rewards and leaderboard progress from real activity.",
  },
];

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[590px] lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-5 rounded-[36px] bg-[linear-gradient(135deg,rgba(124,58,237,0.16),rgba(34,211,238,0.13),rgba(16,185,129,0.16))] blur-3xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/85 p-3 shadow-[0_30px_90px_rgba(67,56,202,0.18)] backdrop-blur-2xl sm:p-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500">
            <Sparkles size={12} className="text-violet-500" />
            Learner workspace
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
          <div className="hidden rounded-2xl bg-[linear-gradient(180deg,#5da69d_0%,#3f9179_100%)] p-3 sm:block">
            <div className="mb-4 rounded-xl bg-white/14 px-3 py-2 text-xs font-extrabold text-white">
              StudyFluxAI
            </div>

            {["Dashboard", "Generate", "Study Library", "AI Tutor", "Study Planner", "Smart Interview"].map(
              (item, index) => (
                <div
                  key={item}
                  className={`mb-2 rounded-xl px-3 py-2 text-[11px] font-bold ${
                    index === 1
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-emerald-50/90"
                  }`}
                >
                  {item}
                </div>
              ),
            )}

            <div className="mt-5 rounded-2xl border border-white/15 bg-emerald-950/16 p-3 text-white">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/80">
                <Coins size={13} />
                FluxGems
              </div>
              <div className="mt-2 text-xs font-semibold text-white/88">
                AI usage wallet
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-violet-100 bg-[linear-gradient(135deg,rgba(124,58,237,0.10),rgba(34,211,238,0.07),rgba(16,185,129,0.08))] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-white/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-violet-600">
                    <Zap size={11} />
                    Generate
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900">
                    Choose how you want to study
                  </h3>
                </div>

                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
                  <Sparkles size={18} />
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3">
                  <FileText size={16} className="text-violet-600" />
                  <div className="mt-2 text-xs font-extrabold text-slate-800">
                    AI Notes
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    Structured study notes
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3">
                  <Target size={16} className="text-cyan-600" />
                  <div className="mt-2 text-xs font-extrabold text-slate-800">
                    AI Quiz
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    Focused practice
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <BookOpenCheck size={16} />
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-800">
                    Study Session
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Notes + Quiz in one flow
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                <MessageCircleQuestion size={18} className="text-cyan-700" />
                <div className="mt-2 text-xs font-extrabold text-slate-800">
                  AI Tutor
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                  Persistent explanations and follow-ups
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/65 p-4">
                <CalendarCheck2 size={18} className="text-emerald-700" />
                <div className="mt-2 text-xs font-extrabold text-slate-800">
                  Study Planner
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                  Goals, dates and linked study material
                </div>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50/65 p-4">
                <BriefcaseBusiness size={18} className="text-violet-700" />
                <div className="mt-2 text-xs font-extrabold text-slate-800">
                  Smart Interview
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                  Adaptive voice practice and reports
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/65 p-4">
                <Trophy size={18} className="text-amber-600" />
                <div className="mt-2 text-xs font-extrabold text-slate-800">
                  Progress
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                  Challenges, achievements and XP
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-white/85 bg-white/92 px-4 py-3 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:flex">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={18} />
        </span>
        <div>
          <div className="text-[11px] font-extrabold text-slate-800">
            One learning workspace
          </div>
          <div className="text-[10px] font-semibold text-slate-400">
            Generate · Learn · Practice · Progress
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(circle_at_12%_15%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_62%_62%,rgba(16,185,129,0.10),transparent_28%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[88%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(99,102,241,0.24),rgba(34,211,238,0.24),transparent)]" />

        <header className="relative z-20 mx-auto flex h-[82px] max-w-7xl items-center justify-between px-5 sm:px-7 lg:px-8">
          <a href="#top" className="shrink-0" aria-label="StudyFluxAI home">
            <img
              src="/studyfluxai-logo.png"
              alt="StudyFluxAI"
              className="w-[178px] sm:w-[195px]"
            />
          </a>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a className="transition hover:text-violet-600" href="#features">
              Features
            </a>
            <a className="transition hover:text-violet-600" href="#how-it-works">
              How it works
            </a>
            <a className="transition hover:text-violet-600" href="#progression">
              Progression
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-white/80 hover:text-slate-900 sm:px-4"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#6d5dfc,#6366f1_48%,#4f46e5)] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(79,70,229,0.30)] active:translate-y-0 sm:px-5"
            >
              Get Started
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>

        <section
          id="top"
          className="relative z-10 mx-auto grid min-h-[calc(100vh-82px)] max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-7 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-24 lg:pt-14"
        >
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/75 px-3 py-1.5 text-xs font-extrabold text-violet-700 shadow-sm backdrop-blur-xl">
              <Sparkles size={14} />
              AI-powered learning, built around you
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[64px]">
              Learn smarter.
              <span className="block bg-[linear-gradient(90deg,#6d28d9_0%,#4f46e5_34%,#0891b2_67%,#059669_100%)] bg-clip-text text-transparent">
                Progress with purpose.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-slate-600 sm:text-lg">
              StudyFluxAI brings AI notes, quizzes, study sessions, tutoring,
              planning, adaptive voice interviews, challenges and progress into one focused learner workspace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6d5dfc,#6366f1_50%,#4f46e5)] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(79,70,229,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.32)] active:translate-y-0"
              >
                Start learning
                <ArrowRight size={17} />
              </Link>

              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/80 px-6 py-3.5 text-sm font-extrabold text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:text-violet-700 active:translate-y-0"
              >
                Explore StudyFluxAI
                <Sparkles size={16} />
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Personalized learning profile
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Saved study history
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole size={14} className="text-violet-500" />
                Secure account flow
              </span>
            </div>
          </div>

          <WorkspacePreview />
        </section>
      </div>

      <section id="features" className="relative border-y border-slate-200/70 bg-white/72 py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-7 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
              One connected workspace
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Everything you need to move from topic to understanding.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">
              StudyFluxAI combines generation, practice, tutoring and learner
              engagement instead of splitting your study flow across separate tools.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.055)] transition duration-300 hover:-translate-y-1 hover:border-violet-200/70 hover:shadow-[0_18px_44px_rgba(79,70,229,0.10)]"
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl border transition ${FEATURE_ACCENTS[feature.accent]}`}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 text-lg font-extrabold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_48%,rgba(139,92,246,0.08),transparent_27%),radial-gradient(circle_at_80%_50%,rgba(16,185,129,0.07),transparent_25%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-7 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
                How it works
              </div>
              <h2 className="mt-3 max-w-lg text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                A learning flow that stays connected from start to finish.
              </h2>
              <p className="mt-4 max-w-lg text-base font-medium leading-7 text-slate-600">
                Your learner profile informs generation, your study activity stays
                saved, and progress grows from the work you actually complete.
              </p>
            </div>

            <div className="space-y-4">
              {WORKFLOW.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[26px] border border-white/85 bg-white/80 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-7"
                >
                  <div className="flex gap-4 sm:gap-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(34,211,238,0.13),rgba(16,185,129,0.14))] text-xs font-black text-violet-700 ring-1 ring-violet-100">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="progression" className="pb-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-7 lg:px-8">
          <div className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.16)]">
            <div className="grid lg:grid-cols-2">
              <div className="relative p-7 sm:p-10 lg:p-12">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(124,58,237,0.25),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(34,211,238,0.14),transparent_30%)]" />
                <div className="relative">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Progress with meaning
                  </div>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                    Learning progress and AI usage stay clearly separated.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
                    XP represents learning progress, while FluxGems power supported AI
                    actions. Each system has a distinct purpose so progression stays
                    understandable and useful.
                  </p>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4">
                      <Trophy size={20} className="text-amber-300" />
                      <div className="mt-3 text-sm font-extrabold text-white">XP</div>
                      <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                        Progress, achievements and leaderboard activity.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
                      <Coins size={20} className="text-emerald-300" />
                      <div className="mt-3 text-sm font-extrabold text-white">
                        FluxGems
                      </div>
                      <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                        Spendable learning currency for supported AI usage.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative border-t border-white/8 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(15,23,42,0.2))] p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-extrabold text-emerald-200">
                  <GraduationCap size={15} />
                  Available now
                </div>
                <h3 className="mt-5 text-2xl font-black text-white">Plan the work. Practice the interview.</h3>
                <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-slate-300">
                  Study Planner keeps learning goals connected to saved material, while Smart Interview turns role preparation into an adaptive voice session with reports and Tutor follow-up.
                </p>

                <div className="mt-7 space-y-3">
                  {[
                    [CalendarCheck2, "Study Planner", "Schedule, reschedule, complete and reopen linked Study Library material."],
                    [BriefcaseBusiness, "Smart Interview", "Adaptive Astra questions, voice answers, detailed reports and AI Tutor deep dives."],
                  ].map(([Icon, title, description]) => (
                    <div key={title} className="flex gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Icon size={17} /></span>
                      <div>
                        <div className="text-sm font-extrabold text-white">{title}</div>
                        <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">{description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-7 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[30px] border border-violet-200/70 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(236,254,255,0.9),rgba(236,253,245,0.92))] px-6 py-10 text-center shadow-[0_20px_60px_rgba(79,70,229,0.09)] sm:px-10 sm:py-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
            <Sparkles size={22} />
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-slate-950">
            Ready to build a smarter study flow?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
            Create your learner profile and start with the tools already available in
            StudyFluxAI today.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-slate-900 active:translate-y-0"
            >
              Create account
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 active:translate-y-0"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-center sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:text-left lg:px-8">
          <img src="/studyfluxai-logo.png" alt="StudyFluxAI" className="mx-auto w-[155px] sm:mx-0" />
          <div className="text-xs font-semibold text-slate-400">
            AI-assisted learning with progress, practice and personalization in one place.
          </div>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;