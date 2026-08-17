import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  Info,
  LayoutDashboard,
  Medal,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import FluxGemMark from "./FluxGemMark";
import useAuth from "../../hooks/useAuth";

const PRIMARY_NAV = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    hoverClass:
      "hover:border-cyan-100/38 hover:bg-cyan-200/16 hover:text-white hover:shadow-[0_14px_32px_rgba(34,211,238,0.16)]",
    iconHoverClass:
      "group-hover:bg-cyan-300/18 group-hover:text-cyan-100",
  },
  {
    label: "Generate",
    icon: Sparkles,
    path: "/generate",
    hoverClass:
      "hover:border-violet-200/38 hover:bg-violet-300/16 hover:text-white hover:shadow-[0_14px_32px_rgba(139,92,246,0.18)]",
    iconHoverClass:
      "group-hover:bg-violet-300/18 group-hover:text-violet-100",
  },
  {
    label: "AI Tutor",
    icon: BrainCircuit,
    path: "/ai-tutor",
    hoverClass:
      "hover:border-emerald-100/42 hover:bg-emerald-200/17 hover:text-white hover:shadow-[0_14px_32px_rgba(16,185,129,0.20)]",
    iconHoverClass:
      "group-hover:bg-emerald-300/18 group-hover:text-emerald-100",
  },
  {
    label: "Study Library",
    icon: BookOpen,
    path: "/library",
    hoverClass:
      "hover:border-sky-100/40 hover:bg-sky-200/16 hover:text-white hover:shadow-[0_14px_32px_rgba(56,189,248,0.17)]",
    iconHoverClass:
      "group-hover:bg-sky-300/18 group-hover:text-sky-100",
  },
  {
    label: "Daily Challenges",
    icon: Trophy,
    path: "/daily-challenges",
    hoverClass:
      "hover:border-emerald-100/42 hover:bg-emerald-200/17 hover:text-white hover:shadow-[0_14px_32px_rgba(16,185,129,0.20)]",
    iconHoverClass:
      "group-hover:bg-emerald-300/18 group-hover:text-emerald-100",
  },
  {
    label: "Leaderboard",
    icon: Medal,
    comingSoon: true,
    hoverClass:
      "hover:border-amber-100/40 hover:bg-amber-200/16 hover:text-white hover:shadow-[0_14px_32px_rgba(245,158,11,0.18)]",
    iconHoverClass:
      "group-hover:bg-amber-300/18 group-hover:text-amber-100",
  },
  {
    label: "Progress",
    icon: BarChart3,
    comingSoon: true,
    hoverClass:
      "hover:border-cyan-100/38 hover:bg-cyan-200/16 hover:text-white hover:shadow-[0_14px_32px_rgba(34,211,238,0.16)]",
    iconHoverClass:
      "group-hover:bg-cyan-300/18 group-hover:text-cyan-100",
  },
];

function NavButton({ item, active, onSelect }) {
  const Icon = item.icon;

  const defaultHover =
    item.hoverClass ||
    "hover:border-white/24 hover:bg-white/14 hover:text-white";

  const defaultIconHover =
    item.iconHoverClass ||
    "group-hover:bg-white/20 group-hover:text-white";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-all duration-200 ${
        active
          ? "border-white/44 bg-[linear-gradient(100deg,rgba(255,255,255,0.24),rgba(236,253,245,0.15))] text-white shadow-[0_18px_38px_rgba(5,80,62,0.24)] ring-1 ring-emerald-100/28"
          : `border-white/10 bg-emerald-950/12 text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${defaultHover}`
      }`}
    >
      {active && (
        <span className="pointer-events-none absolute inset-y-2 left-1 w-1.5 rounded-full bg-gradient-to-b from-white via-cyan-100 to-violet-200 shadow-[0_0_14px_rgba(165,243,252,0.75)]" />
      )}

      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-200 ${
          active
            ? "bg-white/24 text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)] ring-1 ring-white/24"
            : `bg-white/13 text-emerald-50/92 ring-1 ring-white/7 ${defaultIconHover}`
        }`}
      >
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1 truncate">{item.label}</span>

      {item.comingSoon ? (
        <span className="rounded-full border border-white/18 bg-emerald-950/15 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-50/82 shadow-sm transition-colors group-hover:border-white/28 group-hover:bg-white/12 group-hover:text-white">
          Soon
        </span>
      ) : (
        <ChevronRight
          size={15}
          className={
            active
              ? "text-white"
              : "text-emerald-50/60 transition-colors group-hover:text-white"
          }
        />
      )}
    </button>
  );
}

function DashboardSidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

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

    return location.pathname === item.path;
  };

  const goDashboard = () => {
    navigate(user?.role === "admin" ? "/admin" : "/dashboard");
    onClose?.();
  };

  return (
    <>
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

        <div className="sf-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          <nav className="space-y-1.5">
            {PRIMARY_NAV.map((item) => (
              <NavButton
                key={item.label}
                item={item}
                active={isActive(item)}
                onSelect={handleSelect}
              />
            ))}
          </nav>

          {user?.role === "admin" && (
            <>
              <div className="my-3 h-px bg-white/15" />
              <NavButton
                item={{
                  label: "Admin Portal",
                  icon: ShieldCheck,
                  path: "/admin",
                  hoverClass:
                    "hover:border-violet-200/38 hover:bg-violet-300/16 hover:text-white hover:shadow-[0_14px_32px_rgba(139,92,246,0.18)]",
                  iconHoverClass:
                    "group-hover:bg-violet-300/18 group-hover:text-violet-100",
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
                hoverClass:
                  "hover:border-white/24 hover:bg-white/14 hover:text-white hover:shadow-[0_12px_30px_rgba(15,23,42,0.14)]",
                iconHoverClass:
                  "group-hover:bg-white/20 group-hover:text-white",
              }}
              active={false}
              onSelect={handleSelect}
            />

            <NavButton
              item={{
                label: "Help & Support",
                icon: CircleHelp,
                comingSoon: true,
                hoverClass:
                  "hover:border-yellow-300/28 hover:bg-yellow-300/12 hover:text-white hover:shadow-[0_12px_30px_rgba(250,204,21,0.14)]",
                iconHoverClass:
                  "group-hover:bg-yellow-300/18 group-hover:text-yellow-100",
              }}
              active={false}
              onSelect={handleSelect}
            />
          </div>
        </div>

        <div className="relative border-t border-white/8 p-3.5">
          <div className="relative overflow-hidden rounded-3xl border border-white/18 bg-emerald-950/18 p-3.5 pb-9 shadow-[0_20px_44px_rgba(4,64,50,0.18)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(103,232,249,0.12),transparent_34%)]" />

            <div className="relative flex items-center gap-3">
              <FluxGemMark size={40} />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-50/90">
                  FluxGems
                </p>

                <p className="mt-0.5 text-lg font-extrabold text-white">
                  {Number(user?.fluxGems || 0)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate("/wallet");
                  onClose?.();
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/22 bg-white/16 px-2.5 py-2 text-xs font-extrabold text-emerald-50 shadow-sm transition hover:border-white/34 hover:bg-white/22 hover:text-white"
                aria-label="Buy FluxGems"
              >
                <Plus size={14} />
                Buy
              </button>
            </div>

            <p className="relative mt-3 pr-7 text-xs leading-5 text-emerald-50/82">
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
              className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full border border-white/18 bg-white/15 text-emerald-50 shadow-sm transition hover:border-white/30 hover:bg-white/22 hover:text-white"
            >
              <Info size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default DashboardSidebar;
