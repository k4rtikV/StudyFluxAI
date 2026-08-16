import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Info,
  Medal,
  Plus,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router";

import FluxGemMark from "./FluxGemMark";

const PRIMARY_NAV = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    hoverClass:
      "hover:border-indigo-200 hover:bg-indigo-50/90 hover:text-indigo-700",
    iconHoverClass:
      "group-hover:bg-indigo-100 group-hover:text-indigo-700",
  },
  {
    label: "AI Tutor",
    icon: BrainCircuit,
    comingSoon: true,
    hoverClass:
      "hover:border-cyan-200 hover:bg-cyan-50/90 hover:text-cyan-700",
    iconHoverClass:
      "group-hover:bg-cyan-100 group-hover:text-cyan-700",
  },
  {
    label: "Study Library",
    icon: BookOpen,
    comingSoon: true,
    hoverClass:
      "hover:border-violet-200 hover:bg-violet-50/90 hover:text-violet-700",
    iconHoverClass:
      "group-hover:bg-violet-100 group-hover:text-violet-700",
  },
  {
    label: "Daily Challenges",
    icon: Trophy,
    comingSoon: true,
    hoverClass:
      "hover:border-emerald-200 hover:bg-emerald-50/90 hover:text-emerald-700",
    iconHoverClass:
      "group-hover:bg-emerald-100 group-hover:text-emerald-700",
  },
  {
    label: "Leaderboard",
    icon: Medal,
    comingSoon: true,
    hoverClass:
      "hover:border-amber-200 hover:bg-amber-50/90 hover:text-amber-700",
    iconHoverClass:
      "group-hover:bg-amber-100 group-hover:text-amber-700",
  },
  {
    label: "Progress",
    icon: BarChart3,
    comingSoon: true,
    hoverClass:
      "hover:border-sky-200 hover:bg-sky-50/90 hover:text-sky-700",
    iconHoverClass:
      "group-hover:bg-sky-100 group-hover:text-sky-700",
  },
];

function NavButton({
  item,
  active,
  onSelect,
}) {
  const Icon = item.icon;

  const defaultHover =
    item.hoverClass ||
    "hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900";

  const defaultIconHover =
    item.iconHoverClass ||
    "group-hover:bg-slate-100 group-hover:text-slate-700";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 ${
        active
          ? "border-indigo-200 bg-indigo-50/95 text-indigo-700 shadow-sm"
          : `border-transparent text-slate-600 ${defaultHover}`
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-200 ${
          active
            ? "bg-white text-indigo-600 shadow-sm"
            : `bg-slate-50 text-slate-500 ${defaultIconHover}`
        }`}
      >
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {item.comingSoon ? (
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 transition-colors group-hover:border-current/15 group-hover:text-current">
          Soon
        </span>
      ) : (
        <ChevronRight
          size={15}
          className={
            active
              ? "text-indigo-400"
              : "text-slate-300 transition-colors group-hover:text-current"
          }
        />
      )}
    </button>
  );
}
function DashboardSidebar({
  open,
  onClose,
}) {
  const navigate = useNavigate();
  const location = useLocation();

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

    return location.pathname === item.path;
  };

  const goDashboard = () => {
    navigate("/dashboard");
    onClose?.();
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-white/70 bg-white/88 shadow-[8px_0_30px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${
          open
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-slate-100 px-5">
          <button
            type="button"
            onClick={goDashboard}
            className="rounded-xl transition hover:opacity-90"
            aria-label="Go to dashboard"
          >
            <img
              src="/studyfluxai-logo.png"
              alt="StudyFluxAI"
              className="w-[185px]"
            />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Learn
          </p>

          <nav className="mt-3 space-y-1.5">
            {PRIMARY_NAV.map((item) => (
              <NavButton
                key={item.label}
                item={item}
                active={isActive(item)}
                onSelect={handleSelect}
              />
            ))}
          </nav>

          <div className="my-5 h-px bg-slate-100" />

          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <div className="mt-3 space-y-1.5">
            <NavButton
              item={{
                label: "Settings",
                icon: Settings,
                comingSoon: true,
                hoverClass:
                  "hover:border-slate-300 hover:bg-slate-100/90 hover:text-slate-800",
                iconHoverClass:
                  "group-hover:bg-slate-200 group-hover:text-slate-700",
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
                  "hover:border-yellow-200 hover:bg-yellow-50/95 hover:text-yellow-800",
                iconHoverClass:
                  "group-hover:bg-yellow-100 group-hover:text-yellow-700",
              }}
              active={false}
              onSelect={handleSelect}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-cyan-50/70 to-violet-50 p-4 pb-10">
            <div className="flex items-center gap-3">
              <FluxGemMark size={40} />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">
                  FluxGems
                </p>

                <p className="mt-0.5 text-lg font-extrabold text-slate-900">
                  0
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate("/wallet");
                  onClose?.();
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-white/90 px-2.5 py-2 text-xs font-extrabold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-white hover:text-emerald-800"
                aria-label="Buy FluxGems"
              >
                <Plus size={14} />
                Buy
              </button>
            </div>

            <p className="mt-3 pr-7 text-xs leading-5 text-slate-600">
              Earn gems from challenges, learning
              streaks and future achievements.
            </p>

            <button
              type="button"
              onClick={() => {
                navigate("/fluxgems");
                onClose?.();
              }}
              title="Learn about FluxGems"
              aria-label="Learn about FluxGems"
              className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-white/90 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-white hover:text-emerald-800"
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