import {
  ChevronDown,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import useAuth from "../../hooks/useAuth";

const adminSearchItems = [
  {
    label: "Admin Overview",
    description: "Workspace metrics and recent learner activity.",
    path: "/admin",
    icon: LayoutDashboard,
    keywords: ["overview", "stats", "dashboard"],
  },
  {
    label: "Daily Challenges",
    description: "Create, schedule, edit and review challenge performance.",
    path: "/admin/challenges",
    icon: Trophy,
    keywords: ["challenge", "daily", "xp", "rewards"],
  },
  {
    label: "Community Polls",
    description: "Create polls and review community results.",
    path: "/admin/polls",
    icon: MessageSquare,
    keywords: ["poll", "votes", "community"],
  },
  {
    label: "User Management",
    description: "Search learners, inspect accounts and manage access.",
    path: "/admin/users",
    icon: Users,
    keywords: ["users", "students", "accounts", "learners"],
  },
];

function AdminTopbar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return adminSearchItems;

    return adminSearchItems.filter((item) =>
      [item.label, item.description, ...item.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-slate-200/80 bg-white/88 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl lg:left-[286px]">
      <div className="flex min-h-[78px] items-center gap-3 px-4 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu size={19} />
        </button>

        <div ref={searchRef} className="relative min-w-0 flex-1 lg:max-w-[520px]">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search admin workspace"
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-200 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
          />

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] overflow-hidden rounded-[22px] border border-slate-200 bg-white/98 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
                  Admin navigation
                </p>
              </div>
              <div className="p-2">
                {results.length ? (
                  results.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          active ? "bg-emerald-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                          <Icon size={17} />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-slate-800">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    No matching admin section.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-emerald-700 sm:flex">
            <ShieldCheck size={16} />
            <span className="text-xs font-extrabold uppercase tracking-[0.1em]">
              Admin session
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm transition hover:border-emerald-200"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-emerald-900 text-sm font-black text-white">
              {(user?.fullName || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden text-left leading-tight xl:block">
              <p className="max-w-[150px] truncate text-sm font-bold text-slate-800">
                {user?.fullName || "StudyFluxAI Admin"}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                Administrator
              </p>
            </div>
            <ChevronDown size={15} className="hidden text-slate-400 xl:block" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default AdminTopbar;
