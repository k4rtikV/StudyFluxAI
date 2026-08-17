import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useState } from "react";

import useAuth from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";

const primaryItems = [
  { label: "Overview", path: "/admin", icon: LayoutDashboard, end: true },
  { label: "Daily Challenges", path: "/admin/challenges", icon: Trophy },
  { label: "Community Polls", path: "/admin/polls", icon: MessageSquare },
  { label: "User Management", path: "/admin/users", icon: Users },
];

const futureItems = [
  { label: "Leaderboard", path: "/admin/leaderboard", icon: BarChart3 },
  { label: "Announcements", path: "/admin/announcements", icon: Megaphone },
  { label: "Admin Settings", path: "/admin/settings", icon: Settings },
];

function NavItem({ item, onNavigate, soon = false }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group flex min-h-[48px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
          isActive
            ? "border-emerald-400/35 bg-white/12 text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
            : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/7 hover:text-white",
        ].join(" ")
      }
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-emerald-300 transition group-hover:bg-white/12">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {soon && (
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
          Soon
        </span>
      )}
    </NavLink>
  );
}

function AdminSidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close admin navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-white/8 bg-[linear-gradient(180deg,#071225_0%,#081827_48%,#06251f_100%)] px-4 py-4 text-white shadow-[20px_0_60px_rgba(15,23,42,0.18)] transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-4">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex items-center gap-3 text-left"
          >
            <img
              src="/sfai-logo.png"
              alt="StudyFluxAI"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                StudyFluxAI
              </p>
              <p className="mt-0.5 text-sm font-black text-white">Admin Console</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/6 text-slate-300 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-2 mb-4 rounded-2xl border border-emerald-300/12 bg-emerald-300/7 px-3 py-3">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck size={15} />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
              Administrator workspace
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            Manage community content and learner accounts from a dedicated control plane.
          </p>
        </div>

        <nav className="sf-scrollbar flex-1 overflow-y-auto px-1 pb-4">
          <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
          <div className="space-y-1.5">
            {primaryItems.map((item) => (
              <NavItem key={item.path} item={item} onNavigate={onClose} />
            ))}
          </div>

          <div className="my-5 h-px bg-white/8" />

          <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
            Coming next
          </p>
          <div className="space-y-1.5">
            {futureItems.map((item) => (
              <NavItem key={item.path} item={item} onNavigate={onClose} soon />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/8 pt-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-300/20 to-cyan-300/15 text-sm font-black text-emerald-200">
              {(user?.fullName || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user?.fullName || "StudyFluxAI Admin"}
              </p>
              <p className="truncate text-[11px] text-slate-400">Administrator</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/12 bg-rose-400/7 px-4 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-400/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;
