import {
  Award,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "./FluxGemMark";
import useAuth from "../../hooks/useAuth";
import {
  logoutUser,
} from "../../services/authService";

function DashboardTopbar({
  onOpenSidebar,
}) {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [gemMenuOpen, setGemMenuOpen] =
    useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const goTo = (path) => {
    setProfileOpen(false);
    setGemMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
    } catch {
      toast(
        "Your local session has been cleared.",
      );
    } finally {
      logout();

      navigate("/login", {
        replace: true,
      });

      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div className="hidden max-w-md flex-1 md:block">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Search StudyFluxAI"
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() =>
              toast(
                "Notifications will be available in an upcoming phase.",
              )
            }
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell size={18} />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setGemMenuOpen(
                  (current) => !current,
                );
                setProfileOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 transition hover:bg-slate-50"
              aria-label="Open FluxGems wallet menu"
            >
              <FluxGemMark size={32} />

              <div className="hidden text-left sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                  FluxGems
                </p>

                <p className="text-sm font-extrabold leading-4 text-slate-900">
                  0
                </p>
              </div>

              <ChevronDown
                size={14}
                className="hidden text-slate-400 sm:block"
              />
            </button>

            {gemMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close FluxGems menu"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() =>
                    setGemMenuOpen(false)
                  }
                />

                <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-50 via-cyan-50/70 to-violet-50 p-3">
                    <div className="flex items-center gap-3">
                      <FluxGemMark size={38} />

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">
                          FluxGems balance
                        </p>

                        <p className="mt-0.5 text-xl font-extrabold text-slate-900">
                          0
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      goTo("/wallet")
                    }
                    className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>Buy more FluxGems</span>
                    <span className="text-emerald-600">+</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(
                  (current) => !current,
                );
                setGemMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 transition hover:bg-slate-50"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-100 text-sm font-extrabold text-brand-700">
                  {user?.fullName
                    ?.charAt(0)
                    ?.toUpperCase() || "S"}
                </div>
              )}

              <div className="hidden min-w-0 text-left sm:block">
                <p className="max-w-[150px] truncate text-sm font-bold text-slate-800">
                  {user?.fullName ||
                    "Student"}
                </p>

                <p className="text-[11px] font-semibold text-slate-400">
                  Level 1 Learner
                </p>
              </div>

              <ChevronDown
                size={15}
                className="hidden text-slate-400 sm:block"
              />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() =>
                    setProfileOpen(false)
                  }
                />

                <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {user?.fullName}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {user?.email}
                    </p>
                  </div>

                  <div className="my-1 h-px bg-slate-100" />

                  <button
                    type="button"
                    onClick={() =>
                      goTo("/profile")
                    }
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <UserRound size={16} />
                    View profile
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goTo("/achievements")
                    }
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

                    {isLoggingOut
                      ? "Signing out..."
                      : "Sign out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardTopbar;