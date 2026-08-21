import {
  CalendarDays,
  Flame,
  Medal,
  Radio,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import UserAvatar from "../components/common/UserAvatar";
import LevelKite from "../components/progression/LevelKite";
import { getLeaderboard } from "../services/leaderboardService";
import { getRealtimeSocket } from "../utils/realtimeSocket";

const BOARD_OPTIONS = [
  { key: "overall", label: "Overall XP", helper: "Lifetime progression", icon: Trophy },
  { key: "weekly", label: "Weekly XP", helper: "Current UTC week", icon: Zap },
  { key: "monthly", label: "Monthly XP", helper: "Current UTC month", icon: CalendarDays },
  { key: "streak", label: "Streak", helper: "Current learning streak", icon: Flame },
];

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const metricLabel = (board) => (board === "streak" ? "days" : "XP");

const formatPeriod = (period) => {
  if (!period?.startAt || !period?.endAt) return "Lifetime standings";
  const formatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  const end = new Date(period.endAt);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${formatter.format(new Date(period.startAt))} – ${formatter.format(end)}`;
};

function BoardTabs({ value, onChange }) {
  return (
    <div className="grid gap-2 rounded-[28px] border border-violet-100 bg-white/80 p-2 shadow-[0_14px_36px_rgba(76,29,149,0.05)] backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4">
      {BOARD_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`group flex items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-all duration-300 ${
              active
                ? "border-violet-200 bg-[linear-gradient(135deg,rgba(124,58,237,0.09),rgba(34,211,238,0.07),rgba(16,185,129,0.06))] shadow-[0_8px_20px_rgba(124,58,237,0.08)]"
                : "border-transparent hover:border-slate-200 hover:bg-slate-50/90"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                active
                  ? "bg-white text-violet-600 ring-1 ring-violet-200"
                  : "bg-slate-100 text-slate-500 group-hover:bg-white"
              }`}
            >
              <Icon size={18} />
            </span>

            <span className="min-w-0">
              <span className={`block text-sm font-extrabold ${active ? "text-slate-950" : "text-slate-700"}`}>
                {option.label}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{option.helper}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const podiumStyles = {
  1: {
    shell: "border-amber-200 bg-[linear-gradient(125deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98),rgba(245,243,255,0.86))]",
    badge: "border-amber-300 bg-amber-100 text-amber-700",
    accent: "text-amber-600",
  },
  2: {
    shell: "border-sky-200 bg-[linear-gradient(125deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98),rgba(236,254,255,0.88))]",
    badge: "border-slate-300 bg-slate-100 text-slate-600",
    accent: "text-sky-600",
  },
  3: {
    shell: "border-orange-200 bg-[linear-gradient(125deg,rgba(255,247,237,0.98),rgba(255,255,255,0.98),rgba(240,253,244,0.88))]",
    badge: "border-orange-300 bg-orange-100 text-orange-700",
    accent: "text-orange-600",
  },
};

function PodiumCard({ entry, place, board }) {
  if (!entry) return null;

  const style = podiumStyles[place] || podiumStyles[3];

  return (
    <article
      className={`relative flex min-h-[132px] items-center gap-4 overflow-hidden rounded-[24px] border px-4 py-4 sm:px-5 ${style.shell}`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-black ${style.badge}`}
        aria-label={`Rank ${place}`}
      >
        {place}
      </span>

      <UserAvatar
        src={entry.avatar}
        name={entry.fullName}
        className="h-16 w-16 shrink-0 rounded-full ring-4 ring-white"
        initialsClassName="text-lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-black text-slate-950">{entry.fullName}</h3>
          {entry.isCurrentUser ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-700">
              You
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
            <LevelKite level={entry.level} size={20} showTail={false} />
            Level {entry.level}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            <Flame size={11} /> {entry.currentStreak} day streak
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-2xl font-black ${style.accent}`}>
          {formatNumber(entry.score)} <span className="text-sm font-extrabold">{metricLabel(board)}</span>
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">
          {board === "streak" ? `Best ${entry.bestStreak} days` : `${formatNumber(entry.overallXp)} lifetime XP`}
        </p>
      </div>
    </article>
  );
}

function RankingRow({ entry, board }) {
  return (
    <div
      className={`grid items-center gap-3 border-t border-slate-100 px-4 py-3.5 first:border-t-0 sm:grid-cols-[58px_minmax(0,1fr)_120px_130px_130px] sm:px-5 ${
        entry.isCurrentUser
          ? "bg-[linear-gradient(90deg,rgba(124,58,237,0.07),rgba(34,211,238,0.05),rgba(16,185,129,0.05))]"
          : "bg-white/45 hover:bg-slate-50/70"
      } transition-colors`}
    >
      <div className="flex items-center gap-3 sm:block">
        <span
          className={`inline-grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-black ${
            entry.rank === 1
              ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
              : entry.rank === 2
                ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                : entry.rank === 3
                  ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200"
                  : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {entry.rank}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:hidden">Rank</span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar src={entry.avatar} name={entry.fullName} className="h-10 w-10 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-950">
            {entry.fullName}
            {entry.isCurrentUser ? (
              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-700">
                You
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
            Level {entry.level} · {entry.currentStreak} day streak
          </p>
        </div>
      </div>

      <div className="hidden sm:block">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50/80 px-2 py-1 text-[10px] font-bold text-violet-700">
          <LevelKite level={entry.level} size={22} showTail={false} />
          L{entry.level}
        </span>
      </div>

      <div className="hidden items-center gap-1.5 text-xs font-semibold text-slate-600 sm:flex">
        <Flame size={13} className="text-orange-500" /> {entry.currentStreak} days
      </div>

      <div className="text-right">
        <p className="text-sm font-black text-slate-950">
          {formatNumber(entry.score)} {metricLabel(board)}
        </p>
        {board !== "overall" && board !== "streak" ? (
          <p className="mt-0.5 text-[10px] text-slate-500">{formatNumber(entry.overallXp)} lifetime XP</p>
        ) : null}
        {board === "streak" ? (
          <p className="mt-0.5 text-[10px] text-slate-500">Best {entry.bestStreak} days</p>
        ) : null}
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const [board, setBoard] = useState("overall");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const refreshTimer = useRef(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const response = await getLeaderboard({ board, limit: 50 });
        setData(response?.data || null);
        setLoadError("");
      } catch (error) {
        const message = error?.response?.data?.message || "We couldn't load the leaderboard.";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [board],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    socket.emit("leaderboard:join");

    const handleChanged = () => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => load({ quiet: true }), 350);
    };

    socket.on("leaderboard:changed", handleChanged);

    return () => {
      window.clearTimeout(refreshTimer.current);
      socket.off("leaderboard:changed", handleChanged);
      socket.emit("leaderboard:leave");
    };
  }, [load]);

  const entries = data?.entries || [];
  const topThree = entries.slice(0, 3);
  const viewer = data?.viewerEntry || null;
  const viewerInVisibleEntries = viewer ? entries.some((entry) => entry.isCurrentUser) : false;

  const boardTitle = useMemo(
    () => BOARD_OPTIONS.find((option) => option.key === board)?.label || "Leaderboard",
    [board],
  );

  return (
    <>
      <section className="relative overflow-hidden rounded-[32px] border border-violet-100 bg-[linear-gradient(120deg,rgba(255,255,255,0.98)_0%,rgba(248,247,255,0.97)_46%,rgba(238,252,255,0.95)_72%,rgba(240,253,248,0.96)_100%)] px-6 py-7 shadow-[0_18px_50px_rgba(76,29,149,0.06)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-[38%] h-44 w-44 rounded-full bg-violet-200/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              <Trophy size={15} /> Competitive progression
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">StudyFluxAI Leaderboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Compare real XP and learning streaks with the community. FluxGems never affect rank.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[136px] rounded-2xl border border-violet-200 bg-violet-50/75 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-700">
                <Users size={12} /> Participants
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">{formatNumber(data?.participants || 0)}</p>
            </div>

            <div className="min-w-[164px] rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
                <Radio size={12} /> Live
              </p>
              <p className="mt-1 text-sm font-extrabold text-emerald-800">Socket.IO rankings</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <BoardTabs value={board} onChange={setBoard} />
      </section>

      <section className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Current board</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{boardTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatPeriod(data?.period)} · competition windows use {data?.timezone || "UTC"}.
          </p>
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
            data?.redisActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {data?.redisActive ? "Redis accelerated" : "MongoDB fallback"}
        </div>
      </section>

      {loading ? (
        <section className="mt-5 grid min-h-[420px] place-items-center rounded-[30px] border border-violet-100 bg-white/75">
          <div className="text-center">
            <Sparkles className="mx-auto animate-pulse text-violet-500" />
            <p className="mt-3 text-sm font-bold text-slate-600">Building live rankings…</p>
          </div>
        </section>
      ) : loadError && !data ? (
        <section className="mt-5 grid min-h-[360px] place-items-center rounded-[30px] border border-amber-200 bg-amber-50/45 p-8 text-center">
          <div>
            <Trophy className="mx-auto text-amber-500" size={36} />
            <h3 className="mt-4 text-xl font-black text-slate-950">Leaderboard temporarily unavailable</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{loadError}</p>
            <button type="button" onClick={() => load()} className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-violet-700">Retry</button>
          </div>
        </section>
      ) : entries.length === 0 ? (
        <section className="mt-5 grid min-h-[360px] place-items-center rounded-[30px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <div>
            <Trophy className="mx-auto text-slate-300" size={36} />
            <h3 className="mt-4 text-xl font-black text-slate-950">No ranked learners yet</h3>
            <p className="mt-2 text-sm text-slate-500">Earn XP from quiz milestones, achievements and Daily Challenges to populate the board.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-5 rounded-[30px] border border-violet-100 bg-white/75 p-4 shadow-[0_16px_42px_rgba(76,29,149,0.04)] backdrop-blur-xl sm:p-5">
            <div className="mb-4">
              <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
                <Medal size={14} /> Top performers
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Leading the way in learning and consistency</h3>
            </div>

            <div className={`grid gap-4 ${topThree.length === 1 ? "grid-cols-1" : topThree.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
              {topThree.map((entry, index) => (
                <PodiumCard key={`${entry.rank}-${entry.fullName}`} entry={entry} place={index + 1} board={board} />
              ))}
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-[30px] border border-violet-100 bg-white/80 shadow-[0_16px_42px_rgba(76,29,149,0.04)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-cyan-600">Community standings</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Rankings</h3>
                <p className="mt-1 text-xs text-slate-500">Full leaderboard based on {boardTitle}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Top {entries.length}</span>
            </div>

            <div className="hidden grid-cols-[58px_minmax(0,1fr)_120px_130px_130px] gap-3 border-b border-slate-100 bg-slate-50/65 px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400 sm:grid">
              <span>#</span>
              <span>Participant</span>
              <span>Level</span>
              <span>Streak</span>
              <span className="text-right">{board === "streak" ? "Current streak" : boardTitle}</span>
            </div>

            <div>
              {entries.map((entry) => (
                <RankingRow key={`${entry.rank}-${entry.fullName}`} entry={entry} board={board} />
              ))}
            </div>
          </section>

          {viewer && !viewerInVisibleEntries ? (
            <section className="sticky bottom-4 z-20 mt-5 rounded-[24px] border border-violet-200 bg-white/95 p-3 shadow-[0_16px_38px_rgba(76,29,149,0.10)] backdrop-blur-xl">
              <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-600">Your rank</p>
              <RankingRow entry={viewer} board={board} />
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

export default LeaderboardPage;
