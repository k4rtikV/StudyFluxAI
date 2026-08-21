import {
  ArrowUpRight,
  Award,
  Flame,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Wallet,
  BookOpen,
  BrainCircuit,
  LayoutDashboard,
  FileText,
  ClipboardList,
  CornerDownLeft,
  CalendarCheck2,
  BriefcaseBusiness,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";

import FluxGemMark from "./FluxGemMark";
import NotificationPanel from "./NotificationPanel";
import LevelKite from "../progression/LevelKite";
import UserAvatar from "../common/UserAvatar";
import useAuth from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { getProgressOverview } from "../../services/progressService";
import { subscribeToProgressionChanges } from "../../utils/progressionEvents";
import { getStudyPlannerSummary } from "../../services/studyPlannerService";
import { subscribeToStudyPlannerChanges } from "../../utils/studyPlannerEvents";

const SEARCH_ITEMS = [
  {
    label: "Dashboard",
    description: "Overview, progress, daily challenge, and quick actions.",
    path: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "overview", "dashboard", "progress"],
  },
  {
    label: "Generate",
    description: "Open the main generator hub for study content.",
    path: "/generate",
    icon: Sparkles,
    keywords: ["generate", "creator", "notes", "quiz"],
  },
  {
    label: "Generate Notes",
    description: "Create structured study notes from a topic.",
    path: "/generate/notes",
    icon: FileText,
    keywords: ["notes", "study notes", "summary"],
  },
  {
    label: "Generate Quiz",
    description: "Create a quiz from a topic or study material.",
    path: "/generate/quiz",
    icon: ClipboardList,
    keywords: ["quiz", "mcq", "practice"],
  },
  {
    label: "AI Tutor",
    description: "Ask follow-up questions and get guided explanations.",
    path: "/ai-tutor",
    icon: BrainCircuit,
    keywords: ["tutor", "ai tutor", "chat", "help"],
  },
  {
    label: "Study Library",
    description: "Browse saved study sessions, notes, and quizzes.",
    path: "/library",
    icon: BookOpen,
    keywords: ["library", "saved", "sessions", "notes", "quizzes"],
  },
  {
    label: "Study Planner",
    description: "Schedule learning goals and attach related Study Library material.",
    path: "/planner",
    icon: CalendarCheck2,
    keywords: ["planner", "plan", "schedule", "goal", "study time"],
  },
  {
    label: "Smart Interview",
    description: "Set up and practise role-focused mock interviews.",
    path: "/interview",
    icon: BriefcaseBusiness,
    keywords: ["interview", "mock interview", "career", "job", "technical", "behavioral", "coding"],
  },
  {
    label: "Wallet",
    description: "Buy and manage FluxGems.",
    path: "/wallet",
    icon: Wallet,
    keywords: ["wallet", "buy", "fluxgems", "gems"],
  },
  {
    label: "Achievements",
    description: "See milestones and unlocked rewards.",
    path: "/achievements",
    icon: Award,
    keywords: ["achievements", "badges", "milestones", "xp"],
  },
  {
    label: "Settings",
    description: "Manage notifications, optional emails, and timezone preferences.",
    path: "/settings",
    icon: UserRound,
    keywords: ["settings", "preferences", "notifications", "email", "timezone"],
  },
  {
    label: "Help & Support",
    description: "Browse FAQs or send a support request to the administrator.",
    path: "/help",
    icon: BookOpen,
    keywords: ["help", "support", "faq", "contact", "issue"],
  },
  {
    label: "Profile",
    description: "View and manage your learner profile.",
    path: "/profile",
    icon: UserRound,
    keywords: ["profile", "account", "settings", "learner profile"],
  },
];

const formatPlannerTarget = (value) => {
  if (!value) return "No target set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No target set";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatPlannerDuration = (minutes) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${mins} min`;
};

function DashboardTopbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [gemMenuOpen, setGemMenuOpen] = useState(false);
  const [plannerMenuOpen, setPlannerMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [progressOverview, setProgressOverview] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [plannerSummary, setPlannerSummary] = useState(null);

  const profileRef = useRef(null);
  const gemMenuRef = useRef(null);
  const plannerRef = useRef(null);
  const searchRef = useRef(null);

  const goTo = (path) => {
    setProfileOpen(false);
    setGemMenuOpen(false);
    setPlannerMenuOpen(false);
    setSearchOpen(false);
    navigate(path);
  };

  const filteredSearchItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return SEARCH_ITEMS.slice(0, 6);
    }

    return SEARCH_ITEMS.filter((item) => {
      const haystack = [
        item.label,
        item.description,
        ...(item.keywords || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    }).slice(0, 8);
  }, [searchValue]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;

      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }

      if (
        gemMenuRef.current &&
        !gemMenuRef.current.contains(target)
      ) {
        setGemMenuOpen(false);
      }

      if (
        plannerRef.current &&
        !plannerRef.current.contains(target)
      ) {
        setPlannerMenuOpen(false);
      }

      if (
        searchRef.current &&
        !searchRef.current.contains(target)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const loadProgress = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setProgressLoading(true);
      const response = await getProgressOverview();
      const nextProgress = response?.data || null;
      setProgressOverview(nextProgress);
      const rewardBalance = Number(nextProgress?.progression?.fluxGemsBalance);
      if (Number.isFinite(rewardBalance)) {
        setUser((current) => current ? { ...current, fluxGems: rewardBalance } : current);
      }
    } catch {
      // Keep the existing snapshot if a background refresh fails.
    } finally {
      if (!quiet) setProgressLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (profileOpen) {
      loadProgress({ quiet: true });
    }
  }, [loadProgress, profileOpen]);

  useEffect(
    () => subscribeToProgressionChanges(() => loadProgress({ quiet: true })),
    [loadProgress],
  );

  const loadPlannerSummary = useCallback(async () => {
    try {
      const response = await getStudyPlannerSummary();
      setPlannerSummary(response?.data || null);
    } catch {
      // Keep the topbar available if planner summary cannot be loaded.
    }
  }, []);

  useEffect(() => {
    loadPlannerSummary();
  }, [loadPlannerSummary]);

  useEffect(
    () => subscribeToStudyPlannerChanges(loadPlannerSummary),
    [loadPlannerSummary],
  );

  useEffect(() => {
    const timer = window.setInterval(loadPlannerSummary, 60_000);
    return () => window.clearInterval(timer);
  }, [loadPlannerSummary]);

  useEffect(() => {
    setPlannerMenuOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const firstMatch = filteredSearchItems[0];

    if (!firstMatch) {
      toast.error("No matching section found.");
      return;
    }

    goTo(firstMatch.path);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
    } catch {
      toast("Your local session has been cleared.");
    } finally {
      logout();
      navigate("/login", { replace: true });
      setIsLoggingOut(false);
    }
  };

  const progressStats = progressOverview?.stats || {};
  const achievementCount = Object.keys(
    progressOverview?.achievements || {},
  ).length;
  const totalXp = Number(progressStats.totalXp || 0);
  const currentStreak = Number(progressStats.currentStreak || 0);
  const unlockedAchievements = Number(progressStats.unlockedCount || 0);
  const progression = progressOverview?.progression || {};
  const level = Number(progression.level || progressStats.level || 1);
  const xpIntoLevel = Number(progression.xpIntoLevel || 0);
  const xpForLevel = Number(progression.xpForLevel || 0);
  const xpToNextLevel = Number(progression.xpToNextLevel || 0);
  const progressPercent = Number(progression.progressPercent || 0);
  const isMaxLevel = Boolean(progression.isMaxLevel);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-white/14 bg-[linear-gradient(90deg,#0d6b72_0%,#0e7490_22%,#1695b3_38%,#3b82d0_57%,#4f63c7_76%,#6d28b8_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:left-[286px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2%_0%,rgba(255,255,255,0.12),transparent_19%),linear-gradient(90deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.015)_35%,rgba(255,255,255,0.07)_100%)]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-white/18" />

      <div className="relative flex min-h-[82px] items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-100/60 bg-white/86 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div
          ref={searchRef}
          className="relative min-w-0 flex-1 lg:max-w-[300px] xl:max-w-[430px] 2xl:max-w-[540px]"
        >
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search StudyFluxAI"
              className="h-11 w-full rounded-2xl border border-white/86 bg-white/93 py-2.5 pl-11 pr-4 text-sm text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 hover:bg-white/96 focus:border-white focus:bg-white focus:ring-2 focus:ring-cyan-100/70"
            />
          </form>

          {searchOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-[23px] bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 p-[1.5px] shadow-[0_24px_56px_rgba(15,23,42,0.16)]">
              <div className="overflow-hidden rounded-[21.5px] bg-white/96 ring-1 ring-white/70 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100/90 bg-gradient-to-r from-emerald-50/70 via-cyan-50/45 to-violet-50/60 px-4 py-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    {searchValue.trim() ? "Matching sections" : "Quick navigation"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Jump anywhere in StudyFluxAI.
                  </p>
                </div>

                <span className="hidden items-center gap-1.5 rounded-lg border border-white/80 bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm sm:inline-flex">
                  <CornerDownLeft size={12} />
                  Enter to open
                </span>
              </div>

              <div className="sf-scrollbar max-h-[340px] overflow-y-auto p-2">
                {filteredSearchItems.length ? (
                  filteredSearchItems.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.path;

                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => goTo(item.path)}
                        className={`group/search flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                          active
                            ? "border-emerald-200/80 bg-emerald-50/85 shadow-[0_8px_18px_rgba(16,185,129,0.08)]"
                            : "border-transparent hover:border-slate-200/80 hover:bg-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                        }`}
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 via-cyan-100 to-violet-100 text-slate-700 ring-1 ring-white shadow-sm">
                          <Icon size={17} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-800">
                            {item.label}
                          </span>

                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                            {item.description}
                          </span>
                        </span>

                        <ArrowUpRight
                          size={16}
                          className="mt-2 shrink-0 text-slate-300 transition group-hover/search:-translate-y-0.5 group-hover/search:translate-x-0.5 group-hover/search:text-violet-500"
                        />
                      </button>
                    );
                  })
                ) : (
                  <div className="m-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                    No matching section found. Try terms like “quiz”, “tutor”, or “wallet”.
                  </div>
                )}
              </div>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationPanel onNavigate={goTo} />

          <div
            ref={gemMenuRef}
            className="relative shrink-0"
            onMouseEnter={() => {
              setGemMenuOpen(true);
              setProfileOpen(false);
              setPlannerMenuOpen(false);
            }}
            onMouseLeave={() => setGemMenuOpen(false)}
            onFocusCapture={() => {
              setGemMenuOpen(true);
              setProfileOpen(false);
              setPlannerMenuOpen(false);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setGemMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                setGemMenuOpen(true);
                setProfileOpen(false);
                setPlannerMenuOpen(false);
              }}
              className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/84 bg-white/92 px-2.5 py-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
              aria-label="Open FluxGems wallet menu"
              aria-expanded={gemMenuOpen}
            >
              <FluxGemMark size={32} />

              <div className="hidden text-left leading-tight xl:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                  FluxGems
                </p>

                <p className="text-sm font-extrabold text-slate-900">
                  {Number(user?.fluxGems || 0)}
                </p>
              </div>

            </button>

            {gemMenuOpen && (
              <div className="absolute right-0 top-full z-40 w-64 pt-2.5">
                <div className="rounded-[23px] bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 p-[1.5px] shadow-[0_24px_56px_rgba(15,23,42,0.18)]">
                  <div className="rounded-[21.5px] bg-white p-2">
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 via-cyan-50/70 to-violet-50 p-3">
                  <div className="flex items-center gap-3">
                    <FluxGemMark size={38} />

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">
                        FluxGems balance
                      </p>

                      <p className="mt-0.5 text-xl font-extrabold text-slate-900">
                        {Number(user?.fluxGems || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => goTo("/wallet")}
                  className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <span>Buy more FluxGems</span>
                  <span className="text-emerald-600">+</span>
                </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            ref={plannerRef}
            className="relative shrink-0"
            onMouseEnter={() => {
              setPlannerMenuOpen(true);
              setGemMenuOpen(false);
              setProfileOpen(false);
            }}
            onMouseLeave={() => setPlannerMenuOpen(false)}
            onFocusCapture={() => {
              setPlannerMenuOpen(true);
              setGemMenuOpen(false);
              setProfileOpen(false);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setPlannerMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => goTo("/planner")}
              aria-expanded={plannerMenuOpen}
              className={`relative flex min-h-[52px] items-center gap-2 rounded-2xl border px-2.5 py-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition ${
                location.pathname === "/planner"
                  ? "border-violet-100 bg-white text-violet-700"
                  : "border-white/84 bg-white/92 text-slate-600 hover:bg-white"
              }`}
              aria-label="Open Study Planner"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-100 via-cyan-100 to-emerald-100 text-violet-700 ring-1 ring-white">
                <CalendarCheck2 size={17} />
              </span>

              <div className="hidden text-left leading-tight 2xl:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600">
                  Planner
                </p>
                <p className="text-xs font-extrabold text-slate-800">
                  {plannerSummary?.nextPlan ? "Up next" : "Plan study"}
                </p>
              </div>

              {Number(plannerSummary?.upcomingCount || 0) > 0 && (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {Number(plannerSummary.upcomingCount) > 9 ? "9+" : Number(plannerSummary.upcomingCount)}
                </span>
              )}
            </button>

            {plannerMenuOpen && (
            <div className="absolute right-0 top-full z-50 w-[300px] pt-2.5">
              <div className="rounded-[23px] bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 p-[1.5px] shadow-[0_24px_56px_rgba(15,23,42,0.18)]">
                <div className="overflow-hidden rounded-[21.5px] bg-white/97 backdrop-blur-2xl">
                <div className="p-3">
                  {plannerSummary?.nextPlan ? (
                    <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">Up next</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-slate-500 ring-1 ring-slate-200">
                          {plannerSummary.nextPlan.priority || "medium"} priority
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">{plannerSummary.nextPlan.title}</p>
                      <p className="mt-0.5 truncate text-xs font-bold text-violet-600">{plannerSummary.nextPlan.topic}</p>
                      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                        <CalendarCheck2 size={13} className="shrink-0 text-cyan-600" />
                        <span className="truncate">{formatPlannerTarget(plannerSummary.nextPlan.targetAt)}</span>
                      </div>
                      <p className="mt-1 pl-[21px] text-[11px] font-semibold text-slate-500">{formatPlannerDuration(plannerSummary.nextPlan.durationMinutes)}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/75 p-4 text-center">
                      <p className="text-sm font-extrabold text-slate-800">Nothing upcoming yet</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Create a focused study block when you are ready.</p>
                    </div>
                  )}

                  {Number(plannerSummary?.overdueCount || 0) > 0 && (
                    <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                      {Number(plannerSummary.overdueCount)} overdue {Number(plannerSummary.overdueCount) === 1 ? "plan needs" : "plans need"} attention
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => goTo("/planner")}
                    className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span>Open Study Planner</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                </div>
              </div>
            </div>
            )}
          </div>

          <div
            ref={profileRef}
            className="relative shrink-0"
            onMouseEnter={() => {
              setProfileOpen(true);
              setGemMenuOpen(false);
              setPlannerMenuOpen(false);
            }}
            onMouseLeave={() => setProfileOpen(false)}
            onFocusCapture={() => {
              setProfileOpen(true);
              setGemMenuOpen(false);
              setPlannerMenuOpen(false);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setProfileOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                setProfileOpen(true);
                setGemMenuOpen(false);
                setPlannerMenuOpen(false);
              }}
              className="flex min-h-[52px] max-w-[240px] items-center gap-2 rounded-2xl border border-white/84 bg-white/92 p-1.5 pr-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
              aria-expanded={profileOpen}
            >
              <UserAvatar
                user={user}
                className="h-9 w-9 rounded-lg"
                initialsClassName="text-sm"
              />

              {progressOverview ? (
                <LevelKite
                  level={level}
                  size={28}
                  showTail={false}
                  className="hidden shrink-0 xl:block"
                />
              ) : null}

              <div className="hidden min-w-0 flex-1 text-left xl:block">
                <p className="truncate text-sm font-bold text-slate-800">
                  {user?.fullName || "Student"}
                </p>

                <p className="truncate text-[11px] font-semibold text-slate-400">
                  {progressOverview
                    ? `Level ${level} · ${totalXp.toLocaleString()} XP`
                    : "Progress & profile"}
                </p>
              </div>

            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-40 w-[min(22rem,calc(100vw-2rem))] pt-2.5">
                <div className="rounded-[25px] bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 p-[1.5px] shadow-[0_24px_56px_rgba(15,23,42,0.18)]">
                  <div className="rounded-[23.5px] bg-white p-2">
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {user?.fullName}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {user?.email}
                  </p>
                </div>

                <div className="mx-1 mb-2 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-cyan-50/60 to-emerald-50 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <LevelKite level={level} size={54} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-600">
                          Learning level
                        </p>
                        <p className="mt-0.5 text-lg font-black text-slate-950">
                          Level {level}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {totalXp.toLocaleString()} lifetime XP
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => goTo("/achievements")}
                      className="shrink-0 rounded-xl border border-white/90 bg-white/80 px-2.5 py-1.5 text-[11px] font-extrabold text-violet-700 shadow-sm transition hover:bg-white"
                    >
                      Details
                    </button>
                  </div>

                  {progressLoading && !progressOverview ? (
                    <div className="mt-3 rounded-xl border border-white/80 bg-white/55 px-3 py-3 text-xs font-semibold text-slate-500">
                      Loading progression...
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 rounded-xl border border-white/90 bg-white/70 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                          <span className="text-slate-600">
                            {isMaxLevel ? "Level progress" : `Toward Level ${Number(progression.nextLevel || level + 1)}`}
                          </span>
                          <span className="text-violet-700">
                            {isMaxLevel ? "MAX" : `${xpIntoLevel.toLocaleString()} / ${xpForLevel.toLocaleString()} XP`}
                          </span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-600 transition-all duration-500"
                            style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] leading-4 text-slate-500">
                          {isMaxLevel
                            ? "You have reached the current StudyFluxAI level cap."
                            : `${xpToNextLevel.toLocaleString()} XP remaining to Level ${Number(progression.nextLevel || level + 1)}.`}
                        </p>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/90 bg-white/72 px-3 py-2.5 shadow-sm">
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <Flame size={13} />
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Streak</span>
                          </div>
                          <p className="mt-1 text-sm font-extrabold text-slate-900">{currentStreak} days</p>
                        </div>

                        <div className="rounded-xl border border-white/90 bg-white/72 px-3 py-2.5 shadow-sm">
                          <div className="flex items-center gap-1.5 text-violet-600">
                            <Award size={13} />
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Achievements</span>
                          </div>
                          <p className="mt-1 text-sm font-extrabold text-slate-900">
                            {unlockedAchievements}/{achievementCount || 0}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <p className="mt-2.5 text-[10px] leading-4 text-slate-500">
                    XP drives levels and leaderboards. FluxGems remain a separate spendable currency.
                  </p>
                </div>

                <div className="my-1 h-px bg-slate-100" />

                <button
                  type="button"
                  onClick={() => goTo("/profile")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <UserRound size={16} />
                  View profile
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/achievements")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Award size={16} />
                  Achievements
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/settings")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings size={16} />
                  Settings & preferences
                </button>

                <div className="my-1 h-px bg-slate-100" />

                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut size={16} />
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardTopbar;