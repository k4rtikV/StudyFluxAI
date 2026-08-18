import {
  ArrowUpRight,
  Award,
  Bell,
  ChevronDown,
  Flame,
  LogOut,
  Menu,
  Search,
  Sparkles,
  UserRound,
  Wallet,
  BookOpen,
  BrainCircuit,
  LayoutDashboard,
  FileText,
  ClipboardList,
  CornerDownLeft,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";

import FluxGemMark from "./FluxGemMark";
import LevelKite from "../progression/LevelKite";
import UserAvatar from "../common/UserAvatar";
import useAuth from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { getProgressOverview } from "../../services/progressService";
import { subscribeToProgressionChanges } from "../../utils/progressionEvents";

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
    label: "Profile",
    description: "View and manage your learner profile.",
    path: "/profile",
    icon: UserRound,
    keywords: ["profile", "account", "settings", "learner profile"],
  },
];

function DashboardTopbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [gemMenuOpen, setGemMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [progressOverview, setProgressOverview] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const profileRef = useRef(null);
  const gemMenuRef = useRef(null);
  const searchRef = useRef(null);

  const goTo = (path) => {
    setProfileOpen(false);
    setGemMenuOpen(false);
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
      setProgressOverview(response?.data || null);
    } catch {
      // Keep the existing snapshot if a background refresh fails.
    } finally {
      if (!quiet) setProgressLoading(false);
    }
  }, []);

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
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-white/14 bg-[linear-gradient(90deg,rgb(93,166,157)_0%,rgb(93,166,157)_10%,rgb(89,174,164)_20%,rgb(75,177,185)_36%,rgb(61,153,207)_54%,rgb(63,116,207)_72%,rgb(82,88,197)_87%,rgb(104,70,187)_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:left-[286px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_12%,rgba(255,255,255,0.035)_42%,rgba(255,255,255,0.06)_100%)]" />
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
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-[22px] border border-white/80 bg-white/96 shadow-[0_24px_56px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/70 backdrop-blur-2xl">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500" />

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
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() =>
              toast("Notifications will be available in an upcoming phase.")
            }
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/84 bg-white/92 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          <div ref={gemMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setGemMenuOpen((current) => !current);
                setProfileOpen(false);
              }}
              className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/84 bg-white/92 px-2.5 py-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
              aria-label="Open FluxGems wallet menu"
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

              <ChevronDown size={14} className="hidden text-slate-400 xl:block" />
            </button>

            {gemMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
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
            )}
          </div>

          <div ref={profileRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((current) => !current);
                setGemMenuOpen(false);
              }}
              className="flex min-h-[52px] max-w-[240px] items-center gap-2 rounded-2xl border border-white/84 bg-white/92 p-1.5 pr-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
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

              <ChevronDown size={15} className="hidden shrink-0 text-slate-400 xl:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_24px_56px_rgba(15,23,42,0.18)]">
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardTopbar;