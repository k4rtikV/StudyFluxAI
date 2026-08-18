import {
  BarChart3,
  Database,
  Flame,
  LoaderCircle,
  Radio,
  RefreshCcw,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatCard from "../../components/admin/AdminStatCard";
import UserAvatar from "../../components/common/UserAvatar";
import {
  getAdminLeaderboard,
  rebuildAdminLeaderboard,
} from "../../services/adminLeaderboardService";
import { getRealtimeSocket } from "../../utils/realtimeSocket";

const BOARDS = [
  { key: "overall", label: "Overall XP" },
  { key: "weekly", label: "Weekly XP" },
  { key: "monthly", label: "Monthly XP" },
  { key: "streak", label: "Streak" },
];

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const metricLabel = (board) => (board === "streak" ? "days" : "XP");
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not built yet";

function AdminLeaderboardPage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState("overall");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const refreshTimer = useRef(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await getAdminLeaderboard({ board, limit: 100 });
      setPayload(response?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load leaderboard management.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [board]);

  useEffect(() => { load(); }, [load]);

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

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const response = await rebuildAdminLeaderboard();
      toast.success(response?.message || "Leaderboard rebuilt.");
      await load({ quiet: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to rebuild leaderboard.");
    } finally {
      setRebuilding(false);
    }
  };

  const leaderboard = payload?.leaderboard || {};
  const status = payload?.status || {};
  const entries = leaderboard.entries || [];
  const top = entries[0];

  return (
    <>
      <AdminPageHeader
        eyebrow="Competitive progression"
        title="Leaderboard Management"
        description="Inspect live rankings, validate XP standings and rebuild the Redis ranking layer from MongoDB when needed."
        actions={
          <button
            type="button"
            onClick={rebuild}
            disabled={rebuilding}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rebuilding ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
            Rebuild rankings
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Active learners" value={formatNumber(status.activeLearners || 0)} helper="Eligible student accounts" icon={Users} tone="cyan" />
        <AdminStatCard label="Current leader" value={top ? `#1 ${top.fullName}` : "No leader"} helper={top ? `${formatNumber(top.score)} ${metricLabel(board)}` : "Waiting for ranked activity"} icon={Trophy} tone="amber" />
        <AdminStatCard label="Ranking engine" value={status.redisActive ? "Redis" : "MongoDB"} helper={status.redisActive ? "Sorted-set acceleration active" : "Fallback mode active"} icon={Database} tone={status.redisActive ? "emerald" : "violet"} />
        <AdminStatCard label="Live delivery" value="Socket.IO" helper="Open ranking views refresh automatically" icon={Radio} tone="violet" />
      </section>

      <section className="mt-5 rounded-[30px] border border-slate-200 bg-white/80 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-600">Ranking views</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Competition boards</h2>
            <p className="mt-1 text-sm text-slate-500">Weekly and monthly competition windows use {leaderboard.timezone || "UTC"} so every learner competes on the same clock.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setBoard(item.key)}
                className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${board === item.key ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Cache built</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDate(status.cacheBuiltAt)}</p></div>
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Cached learners</p><p className="mt-1 text-sm font-bold text-slate-800">{formatNumber(status.cacheParticipants || 0)}</p></div>
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">Board participants</p><p className="mt-1 text-sm font-bold text-slate-800">{formatNumber(leaderboard.participants || 0)}</p></div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-slate-200 bg-white/82 shadow-[0_18px_44px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Live standings</p><h2 className="mt-1 text-xl font-black text-slate-900">{BOARDS.find((item) => item.key === board)?.label}</h2></div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${leaderboard.redisActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {leaderboard.redisActive ? <Zap size={12} /> : <Database size={12} />}
            {leaderboard.redisActive ? "Redis accelerated" : "MongoDB fallback"}
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[360px] place-items-center"><LoaderCircle className="animate-spin text-violet-500" size={28} /></div>
        ) : entries.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center px-6 text-center"><div><BarChart3 className="mx-auto text-slate-300" size={34} /><h3 className="mt-3 text-lg font-black text-slate-900">No ranking data yet</h3><p className="mt-2 text-sm text-slate-500">Learners will appear as XP and streak activity is recorded.</p></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <tr><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Learner</th><th className="px-5 py-3">Level</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Lifetime XP</th><th className="px-5 py-3">Streak</th><th className="px-5 py-3 text-right">Inspect</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.userId} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm font-black text-slate-700">#{entry.rank}</td>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><UserAvatar src={entry.avatar} name={entry.fullName} className="h-10 w-10 rounded-xl" /><p className="font-extrabold text-slate-900">{entry.fullName}</p></div></td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-600">Level {entry.level}</td>
                    <td className="px-5 py-4 text-sm font-black text-violet-700">{formatNumber(entry.score)} {metricLabel(board)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-600">{formatNumber(entry.overallXp)} XP</td>
                    <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><Flame size={13} /> {entry.currentStreak} days</span></td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => navigate(`/admin/users/${entry.userId}`)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">View learner</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/65 p-5"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">Source of truth</p><h3 className="mt-2 text-lg font-black text-slate-900">MongoDB owns progression</h3><p className="mt-2 text-sm leading-6 text-slate-600">Rebuild reads learner activity and achievement state from MongoDB, synchronizes XP ledger entries, then reconstructs the Redis sorted sets.</p></div>
        <div className="rounded-[26px] border border-violet-200 bg-violet-50/65 p-5"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-700">Moderation rule</p><h3 className="mt-2 text-lg font-black text-slate-900">Ranks are not manually editable</h3><p className="mt-2 text-sm leading-6 text-slate-600">Admins can inspect and rebuild rankings, but XP remains derived from verified learner activity rather than arbitrary score edits.</p></div>
      </section>
    </>
  );
}

export default AdminLeaderboardPage;
