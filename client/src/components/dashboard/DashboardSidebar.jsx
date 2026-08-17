import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CircleHelp,
  Info,
  LayoutDashboard,
  Lightbulb,
  Medal,
  NotebookPen,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

import FluxGemMark from "./FluxGemMark";
import useAuth from "../../hooks/useAuth";

const PRIMARY_NAV = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "Generate",
    icon: Sparkles,
    path: "/generate",
  },
  {
    label: "AI Tutor",
    icon: BrainCircuit,
    path: "/ai-tutor",
  },
  {
    label: "Study Library",
    icon: BookOpen,
    path: "/library",
  },
  {
    label: "Daily Challenges",
    icon: Trophy,
    path: "/daily-challenges",
  },
  {
    label: "Leaderboard",
    icon: Medal,
    comingSoon: true,
  },
  {
    label: "Progress",
    icon: BarChart3,
    comingSoon: true,
  },
];

function NavButton({ item, active, onSelect }) {
  const Icon = item.icon;
  const [hovered, setHovered] = useState(false);
  const emphasized = active || hovered;

  const gradientStroke = emphasized
    ? "url(#studyflux-sidebar-nav-gradient)"
    : "currentColor";

  return (
    <div
      className="relative w-full lg:w-[270px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => onSelect(item)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`group relative z-10 flex w-full items-center gap-3 border px-3 py-2 text-left text-sm font-semibold transition-[background-color,border-color,color,transform] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.992] lg:origin-left ${
          emphasized
            ? "rounded-2xl border-white/65 bg-[linear-gradient(100deg,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.985)_100%)] text-slate-800 lg:rounded-r-none lg:border-r-0"
            : "rounded-2xl border-white/10 bg-emerald-950/12 text-white/88 hover:border-white/22 hover:bg-white/10"
        }`}
      >
        {emphasized && (
          <span className="pointer-events-none absolute inset-y-2 left-1 w-1.5 rounded-full bg-[linear-gradient(180deg,#7c3aed_0%,#22d3ee_52%,#10b981_100%)]" />
        )}

        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-[background-color,border-color,color,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            emphasized
              ? "bg-[linear-gradient(135deg,rgba(124,58,237,0.13),rgba(34,211,238,0.13),rgba(16,185,129,0.14))] ring-1 ring-violet-200/70"
              : "bg-white/13 text-emerald-50/92 ring-1 ring-white/7 group-hover:bg-white/16"
          }`}
        >
          <Icon
            size={18}
            stroke={gradientStroke}
            strokeWidth={emphasized ? 2.35 : 2}
            className="transition-[stroke,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          />
        </span>

        <span
          className={`min-w-0 flex-1 truncate transition-[color,opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            emphasized
              ? "bg-[linear-gradient(90deg,#6d28d9_0%,#2563eb_34%,#06b6d4_62%,#059669_100%)] bg-clip-text font-extrabold text-transparent"
              : "text-inherit"
          }`}
        >
          {item.label}
        </span>

        {item.comingSoon ? (
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide transition-[background-color,border-color,color,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              emphasized
                ? "border-violet-200/80 bg-violet-50 text-violet-600"
                : "border-white/18 bg-emerald-950/15 text-emerald-50/82"
            }`}
          >
            Soon
          </span>
        ) : null}
      </button>

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-full hidden w-12 origin-left rounded-r-2xl border-y border-r border-white/65 bg-[linear-gradient(90deg,rgba(255,255,255,0.985)_0%,rgba(247,248,252,0.97)_55%,rgba(247,248,252,0)_100%)] transition-[opacity,transform] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
          emphasized ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
      />
    </div>
  );
}

function GenerateNavGroup({ active, pathname, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const studySessionActive = pathname === "/generate";
  const notesActive = pathname === "/generate/notes";
  const quizActive = pathname === "/generate/quiz";
  const generateRouteActive = studySessionActive || notesActive || quizActive;
  const expanded = hovered || focused || generateRouteActive;
  const emphasized = active || hovered || focused;

  const gradientStroke = emphasized
    ? "url(#studyflux-sidebar-nav-gradient)"
    : "currentColor";

  const handleFocusOut = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(false);
    }
  };

  const subItems = [
    {
      label: "AI Notes",
      icon: NotebookPen,
      path: "/generate/notes",
      active: notesActive,
    },
    {
      label: "AI Quiz",
      icon: Lightbulb,
      path: "/generate/quiz",
      active: quizActive,
    },
  ];

  return (
    <div
      className={`relative grid w-full overflow-visible transition-[grid-template-rows] duration-[480ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:w-[270px] ${
        expanded
          ? "grid-rows-[54px_48px_58px]"
          : "grid-rows-[54px_0px_0px]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={handleFocusOut}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl border transition-[background-color,border-color] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          emphasized
            ? "border-white/65 bg-[linear-gradient(100deg,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.985)_100%)] lg:rounded-r-none lg:border-r-0"
            : "border-white/10 bg-emerald-950/12"
        }`}
      />

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-full hidden w-12 origin-left rounded-r-2xl border-y border-r border-white/65 bg-[linear-gradient(90deg,rgba(255,255,255,0.985)_0%,rgba(247,248,252,0.97)_55%,rgba(247,248,252,0)_100%)] transition-[opacity,transform] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
          emphasized ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
      />

      {emphasized && (
        <span className="pointer-events-none absolute inset-y-2 left-1 z-20 w-1.5 rounded-full bg-[linear-gradient(180deg,#7c3aed_0%,#22d3ee_52%,#10b981_100%)]" />
      )}

      <button
        type="button"
        onClick={() => onSelect({ path: "/generate" })}
        className={`group relative z-10 flex h-[54px] w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-[color,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.992] ${
          emphasized ? "text-slate-800" : "text-white/88"
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-[background-color,border-color,color,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            emphasized
              ? "bg-[linear-gradient(135deg,rgba(124,58,237,0.13),rgba(34,211,238,0.13),rgba(16,185,129,0.14))] ring-1 ring-violet-200/70"
              : "bg-white/13 text-emerald-50/92 ring-1 ring-white/7 group-hover:bg-white/16"
          }`}
        >
          <Sparkles
            size={18}
            stroke={gradientStroke}
            strokeWidth={emphasized ? 2.35 : 2}
            className="transition-[stroke,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          />
        </span>

        <span
          className={`min-w-0 flex-1 truncate transition-[color,opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            emphasized
              ? "bg-[linear-gradient(90deg,#6d28d9_0%,#2563eb_34%,#06b6d4_62%,#059669_100%)] bg-clip-text font-extrabold text-transparent"
              : "text-inherit"
          }`}
        >
          Generate
        </span>
      </button>

      <div className="relative z-10 min-h-0 overflow-hidden">
        <div
          className={`grid h-12 grid-cols-2 gap-2 px-2 pb-2 transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            expanded
              ? "translate-y-0 opacity-100 delay-75"
              : "-translate-y-1 opacity-0"
          }`}
        >
          {subItems.map((subItem) => {
            const SubIcon = subItem.icon;

            return (
              <button
                key={subItem.path}
                type="button"
                onClick={() => onSelect({ path: subItem.path })}
                className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-extrabold transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] ${
                  subItem.active
                    ? "border-violet-200/90 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(34,211,238,0.10),rgba(16,185,129,0.10))] text-violet-700"
                    : "border-slate-200/80 bg-white/70 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/75 hover:text-cyan-700"
                }`}
                aria-current={subItem.active ? "page" : undefined}
              >
                <SubIcon size={14} strokeWidth={2.2} />
                <span className="truncate">{subItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 min-h-0 overflow-hidden px-2 pb-2">
        <button
          type="button"
          onClick={() => onSelect({ path: "/generate" })}
          className={`flex h-[50px] w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-[background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] ${
            studySessionActive
              ? "border-violet-200/90 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(34,211,238,0.10),rgba(16,185,129,0.10))] text-violet-700"
              : "border-slate-200/80 bg-white/72 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/75 hover:text-emerald-700"
          } ${
            expanded
              ? "translate-y-0 opacity-100 delay-100"
              : "-translate-y-1 opacity-0"
          }`}
          aria-current={studySessionActive ? "page" : undefined}
        >
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              studySessionActive
                ? "bg-violet-100/90 text-violet-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <BookOpen size={15} strokeWidth={2.2} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-extrabold leading-4">
              Study Session
            </span>
            <span
              className={`mt-0.5 block truncate text-[10px] font-semibold leading-3 ${
                studySessionActive ? "text-violet-500" : "text-slate-400"
              }`}
            >
              Notes + Quiz
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function DashboardSidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [fluxGemHovered, setFluxGemHovered] = useState(false);

  const fluxGemSectionActive =
    location.pathname === "/wallet" || location.pathname === "/fluxgems";

  const fluxGemEmphasized = fluxGemSectionActive || fluxGemHovered;

  const handleSelect = (item) => {
    if (item.comingSoon) {
      return;
    }

    if (item.path) {
      navigate(item.path);
      onClose?.();
    }
  };

  const isActive = (item) => {
    if (!item.path) {
      return false;
    }

    if (
      item.path === "/library" &&
      location.pathname.startsWith("/study/")
    ) {
      return true;
    }

    if (
      item.path === "/generate" &&
      location.pathname.startsWith("/generate")
    ) {
      return true;
    }

    return location.pathname === item.path;
  };

  const goDashboard = () => {
    navigate(user?.role === "admin" ? "/admin" : "/dashboard");
    onClose?.();
  };

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="studyflux-sidebar-nav-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="36%" stopColor="#2563eb" />
            <stop offset="66%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-transparent bg-[linear-gradient(180deg,rgb(93,166,157)_0%,rgba(86,171,151,0.96)_38%,rgba(62,143,119,0.95)_100%)] shadow-[6px_0_24px_rgba(4,44,35,0.08)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_20%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_center_right,rgba(16,185,129,0.16),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_28%)]" />

        <div className="relative flex h-[76px] items-center justify-between border-b border-white/8 px-5">
          <button
            type="button"
            onClick={goDashboard}
            className="rounded-xl px-1.5 py-1 transition hover:scale-[1.015] hover:opacity-95"
            aria-label="Go to dashboard"
          >
            <img
              src="/studyfluxai-logo.png"
              alt="StudyFluxAI"
              className="w-[185px]"
              style={{
                filter:
                  "drop-shadow(1px 0 0 rgba(255,255,255,0.96)) drop-shadow(-1px 0 0 rgba(255,255,255,0.96)) drop-shadow(0 1px 0 rgba(255,255,255,0.96)) drop-shadow(0 -1px 0 rgba(255,255,255,0.96)) drop-shadow(1px 1px 0 rgba(255,255,255,0.82)) drop-shadow(-1px 1px 0 rgba(255,255,255,0.82)) drop-shadow(1px -1px 0 rgba(255,255,255,0.82)) drop-shadow(-1px -1px 0 rgba(255,255,255,0.82)) drop-shadow(0 4px 12px rgba(4,44,35,0.18))",
              }}
            />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-emerald-100/75 transition hover:bg-white/8 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sf-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 lg:w-[calc(100%+64px)] lg:pr-20">
          <nav className="space-y-1.5">
            {PRIMARY_NAV.map((item) =>
              item.path === "/generate" ? (
                <GenerateNavGroup
                  key={item.label}
                  active={isActive(item)}
                  pathname={location.pathname}
                  onSelect={handleSelect}
                />
              ) : (
                <NavButton
                  key={item.label}
                  item={item}
                  active={isActive(item)}
                  onSelect={handleSelect}
                />
              ),
            )}
          </nav>

          {user?.role === "admin" && (
            <>
              <div className="my-3 h-px bg-white/15" />

              <NavButton
                item={{
                  label: "Admin Portal",
                  icon: ShieldCheck,
                  path: "/admin",
                }}
                active={location.pathname.startsWith("/admin")}
                onSelect={handleSelect}
              />
            </>
          )}

          <div className="my-3 h-px bg-white/15" />

          <div className="space-y-1.5">
            <NavButton
              item={{
                label: "Settings",
                icon: Settings,
                comingSoon: true,
              }}
              active={false}
              onSelect={handleSelect}
            />

            <NavButton
              item={{
                label: "Help & Support",
                icon: CircleHelp,
                comingSoon: true,
              }}
              active={false}
              onSelect={handleSelect}
            />
          </div>
        </div>

        <div className="relative border-t border-white/8 p-3.5">
          <div
            className="relative"
            onMouseEnter={() => setFluxGemHovered(true)}
            onMouseLeave={() => setFluxGemHovered(false)}
            onFocusCapture={() => setFluxGemHovered(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFluxGemHovered(false);
              }
            }}
          >
            {/* Default emerald FluxGem surface */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 rounded-3xl border border-white/18 bg-emerald-950/18 shadow-[0_20px_44px_rgba(4,64,50,0.18)] transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                fluxGemEmphasized
                  ? "scale-[0.995] opacity-0"
                  : "scale-100 opacity-100"
              }`}
            >
              <span className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(103,232,249,0.12),transparent_34%)]" />
            </span>

            {/* Unified active surface + workspace spill */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-3xl bg-white transition-[opacity,transform] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:w-[calc(100%+64px)] lg:bg-[linear-gradient(90deg,rgba(255,255,255,0.998)_0%,rgba(255,255,255,0.998)_80%,rgba(250,251,253,0.965)_88%,rgba(247,248,252,0)_100%)] ${
                fluxGemEmphasized
                  ? "translate-x-0 scale-x-100 opacity-100"
                  : "-translate-x-1 scale-x-[0.94] opacity-0"
              }`}
            />

            <div className="relative z-10 overflow-hidden rounded-3xl p-3.5 pb-9">
              <div
                className={`pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  fluxGemEmphasized
                    ? "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.08),transparent_34%)] opacity-100"
                    : "opacity-0"
                }`}
              />

              {fluxGemEmphasized && (
                <span className="pointer-events-none absolute inset-y-3 left-1 w-1.5 rounded-full bg-[linear-gradient(180deg,#7c3aed_0%,#22d3ee_52%,#10b981_100%)]" />
              )}

              <div className="relative flex items-center gap-3">
                <FluxGemMark size={40} />

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[13px] font-bold uppercase tracking-[0.105em] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      fluxGemEmphasized
                        ? "bg-[linear-gradient(90deg,#6d28d9_0%,#2563eb_34%,#06b6d4_62%,#059669_100%)] bg-clip-text text-transparent"
                        : "text-emerald-50/90"
                    }`}
                  >
                    FluxGems
                  </p>

                  <p
                    className={`mt-0.5 text-[19px] font-extrabold leading-5 transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      fluxGemEmphasized ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {Number(user?.fluxGems || 0)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigate("/wallet");
                    onClose?.();
                  }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-extrabold transition-[background-color,border-color,color,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] ${
                    fluxGemEmphasized
                      ? "border-violet-200/80 bg-violet-50/80 text-violet-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                      : "border-white/22 bg-white/16 text-emerald-50 shadow-sm hover:border-white/34 hover:bg-white/22 hover:text-white"
                  }`}
                  aria-label="Buy FluxGems"
                >
                  <Plus size={14} />
                  Buy
                </button>
              </div>

              <p
                className={`relative mt-2.5 pr-7 text-[13px] leading-[18px] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  fluxGemEmphasized
                    ? "text-slate-600"
                    : "text-emerald-50/82"
                }`}
              >
                Earn gems from challenges, learning streaks and future
                achievements.
              </p>

              <button
                type="button"
                onClick={() => {
                  navigate("/fluxgems");
                  onClose?.();
                }}
                title="Learn about FluxGems"
                aria-label="Learn about FluxGems"
                className={`absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.94] ${
                  fluxGemEmphasized
                    ? "border-emerald-200/90 bg-emerald-50 text-emerald-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                    : "border-white/18 bg-white/15 text-emerald-50 shadow-sm hover:border-white/30 hover:bg-white/22 hover:text-white"
                }`}
              >
                <Info size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default DashboardSidebar;