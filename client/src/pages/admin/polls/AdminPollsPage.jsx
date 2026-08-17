import {
  CalendarClock,
  Edit3,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../components/admin/AdminStatusBadge";
import {
  deleteAdminPoll,
  getAdminPolls,
  updateAdminPoll,
} from "../../../services/adminCommunityService";
import { formatAdminDate } from "../../../utils/adminCommunityForms";

const filters = ["all", "live", "scheduled", "draft", "ended"];

function AdminPollsPage() {
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await getAdminPolls();
      setPolls(response.data?.polls || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load community polls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? polls : polls.filter((item) => item.status === filter)),
    [polls, filter],
  );

  const counts = useMemo(
    () =>
      polls.reduce(
        (acc, poll) => ({ ...acc, [poll.status]: (acc[poll.status] || 0) + 1 }),
        {},
      ),
    [polls],
  );

  const endPoll = async (poll) => {
    if (!window.confirm("End this community poll now? Existing votes and results will be preserved.")) return;
    try {
      setActionId(poll.id);
      await updateAdminPoll(poll.id, {
        status: "ended",
        expiresAt: new Date().toISOString(),
      });
      toast.success("Poll ended.");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not end this poll.");
    } finally {
      setActionId("");
    }
  };

  const removePoll = async (poll) => {
    if (!window.confirm("Delete this poll? Only polls with no votes can be deleted.")) return;
    try {
      setActionId(poll.id);
      await deleteAdminPoll(poll.id);
      toast.success("Poll deleted.");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete this poll.");
    } finally {
      setActionId("");
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Community content"
        title="Community Polls"
        description="Run lightweight community questions, monitor participation and keep results live for learners through Socket.IO."
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/polls/new")}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(109,40,217,0.2)] transition hover:bg-violet-700"
          >
            <Plus size={17} /> Create Poll
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
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-violet-500" />
        </div>
      ) : visible.length ? (
        <div className="space-y-3">
          {visible.map((poll) => (
            <article key={poll.id} className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.045)] sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge status={poll.status} />
                    <span className="text-xs font-bold text-slate-500">{poll.results.totalVotes} vote{poll.results.totalVotes === 1 ? "" : "s"}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">{poll.question}</h2>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <CalendarClock size={14} /> {formatAdminDate(poll.publishAt)} → {formatAdminDate(poll.expiresAt)}
                  </p>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {poll.options.map((option) => {
                      const result = poll.results.options.find((item) => item.optionId === option.id);
                      const percentage = result?.percentage || 0;
                      return (
                        <div key={option.id} className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                          <div className="absolute inset-y-0 left-0 bg-violet-100/70" style={{ width: `${percentage}%` }} />
                          <div className="relative flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-slate-700">{option.text}</span>
                            <span className="font-black text-violet-700">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/polls/${poll.id}/edit`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                  {poll.status !== "ended" && (
                    <button
                      type="button"
                      disabled={actionId === poll.id}
                      onClick={() => endPoll(poll)}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      End now
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionId === poll.id}
                    onClick={() => removePoll(poll)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                    aria-label="Delete poll"
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
            <MessageSquare size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 font-bold text-slate-700">No {filter === "all" ? "" : filter} Community Polls</p>
            <p className="mt-1 text-sm text-slate-500">Create a poll or switch the status filter.</p>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminPollsPage;
