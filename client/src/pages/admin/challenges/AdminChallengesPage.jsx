import {
  CalendarClock,
  Edit3,
  Gem,
  Plus,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../components/admin/AdminStatusBadge";
import {
  deleteAdminChallenge,
  getAdminChallenges,
  updateAdminChallenge,
} from "../../../services/adminCommunityService";
import { formatAdminDate } from "../../../utils/adminCommunityForms";

const filters = ["all", "live", "scheduled", "draft", "ended"];

function AdminChallengesPage() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await getAdminChallenges();
      setChallenges(response.data?.challenges || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load Daily Challenges.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? challenges : challenges.filter((item) => item.status === filter)),
    [challenges, filter],
  );

  const counts = useMemo(
    () =>
      challenges.reduce(
        (acc, challenge) => ({ ...acc, [challenge.status]: (acc[challenge.status] || 0) + 1 }),
        {},
      ),
    [challenges],
  );

  const endChallenge = async (challenge) => {
    if (!window.confirm("End this Daily Challenge now? Existing attempt history will be preserved.")) return;
    try {
      setActionId(challenge.id);
      await updateAdminChallenge(challenge.id, {
        status: "ended",
        expiresAt: new Date().toISOString(),
      });
      toast.success("Challenge ended.");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not end this challenge.");
    } finally {
      setActionId("");
    }
  };

  const removeChallenge = async (challenge) => {
    if (!window.confirm("Delete this challenge? Only challenges with no attempts can be deleted.")) return;
    try {
      setActionId(challenge.id);
      await deleteAdminChallenge(challenge.id);
      toast.success("Challenge deleted.");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete this challenge.");
    } finally {
      setActionId("");
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Community content"
        title="Daily Challenges"
        description="Create one universal challenge window at a time, control rewards and review learner performance without exposing the answer key to student clients."
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/challenges/new")}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700"
          >
            <Plus size={17} /> Create Challenge
          </button>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/85 p-2 shadow-sm">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-extrabold capitalize transition ${
              filter === item ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {item} {item !== "all" && `(${counts[item] || 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-[350px] place-items-center rounded-[28px] border border-slate-200 bg-white/80">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
        </div>
      ) : visible.length ? (
        <div className="space-y-3">
          {visible.map((challenge) => (
            <article key={challenge.id} className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.045)] sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge status={challenge.status} />
                    <span className="text-xs font-bold text-slate-500">{challenge.category} · {challenge.difficulty}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">{challenge.question}</h2>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} /> {formatAdminDate(challenge.publishAt)} → {formatAdminDate(challenge.expiresAt)}</span>
                    <span className="inline-flex items-center gap-1.5 text-amber-700"><Zap size={14} /> {challenge.xpReward} XP</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700"><Gem size={14} /> {challenge.fluxGemReward} FluxGems</span>
                  </div>
                  <div className="mt-4 grid max-w-xl grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Attempts</p>
                      <p className="mt-1 text-lg font-black text-slate-800">{challenge.stats.attempts}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600">Correct</p>
                      <p className="mt-1 text-lg font-black text-slate-800">{challenge.stats.correct}</p>
                    </div>
                    <div className="rounded-xl bg-cyan-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-600">Accuracy</p>
                      <p className="mt-1 text-lg font-black text-slate-800">{challenge.stats.accuracy}%</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/challenges/${challenge.id}/edit`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                  {challenge.status !== "ended" && (
                    <button
                      type="button"
                      disabled={actionId === challenge.id}
                      onClick={() => endChallenge(challenge)}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      End now
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionId === challenge.id}
                    onClick={() => removeChallenge(challenge)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                    aria-label="Delete challenge"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[330px] place-items-center rounded-[28px] border border-dashed border-slate-300 bg-white/65 px-6 text-center">
          <div>
            <Trophy size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 font-bold text-slate-700">No {filter === "all" ? "" : filter} Daily Challenges</p>
            <p className="mt-1 text-sm text-slate-500">Create a challenge or switch the status filter.</p>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminChallengesPage;
