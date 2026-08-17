import {
  ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import {
  createAdminPoll,
  getAdminPolls,
  updateAdminPoll,
} from "../../../services/adminCommunityService";
import {
  emptyPollForm,
  toAdminApiPayload,
  toAdminInputDate,
} from "../../../utils/adminCommunityForms";

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
      {children}
    </label>
  );
}

function AdminPollEditorPage() {
  const navigate = useNavigate();
  const { pollId } = useParams();
  const editing = Boolean(pollId);
  const [form, setForm] = useState(emptyPollForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [existingVotes, setExistingVotes] = useState(0);

  useEffect(() => {
    if (!editing) return;

    const load = async () => {
      try {
        setLoading(true);
        const response = await getAdminPolls();
        const poll = (response.data?.polls || []).find((item) => item.id === pollId);
        if (!poll) {
          toast.error("Poll not found.");
          navigate("/admin/polls", { replace: true });
          return;
        }

        setExistingVotes(poll.results.totalVotes || 0);
        setForm({
          question: poll.question,
          options: poll.options.map((option) => option.text),
          status: poll.status,
          publishAt: toAdminInputDate(poll.publishAt),
          expiresAt: toAdminInputDate(poll.expiresAt),
        });
      } catch (error) {
        toast.error(error?.response?.data?.message || "Could not load this poll.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [editing, navigate, pollId]);

  const setOption = (index, value) =>
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    }));

  const addOption = () => {
    if (form.options.length < 6 && existingVotes === 0) {
      setForm((current) => ({ ...current, options: [...current.options, ""] }));
    }
  };

  const removeOption = (index) => {
    if (form.options.length > 2 && existingVotes === 0) {
      setForm((current) => ({
        ...current,
        options: current.options.filter((_, optionIndex) => optionIndex !== index),
      }));
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = toAdminApiPayload(form);
      if (editing) await updateAdminPoll(pollId, payload);
      else await createAdminPoll(payload);
      toast.success(editing ? "Poll updated." : "Poll created.");
      navigate("/admin/polls", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save this poll.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="animate-spin text-violet-600" /></div>;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Community Polls"
        title={editing ? "Edit Poll" : "Create Poll"}
        description="Create a two-to-six option community question and control its publishing window. Poll options are locked once voting begins."
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/polls")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            <ArrowLeft size={16} /> Back to polls
          </button>
        }
      />

      <section className="rounded-[30px] border border-violet-200 bg-gradient-to-br from-white via-violet-50/40 to-cyan-50/45 p-5 shadow-[0_20px_50px_rgba(109,40,217,0.07)] sm:p-7">
        {existingVotes > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            This poll already has {existingVotes} vote{existingVotes === 1 ? "" : "s"}. Its options are locked to preserve historical result integrity.
          </div>
        )}

        <div>
          <FieldLabel>Poll question</FieldLabel>
          <textarea
            value={form.question}
            onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
            rows={4}
            placeholder="Which AI tool do you use most for studying?"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100/45"
          />
        </div>

        <div className="mt-5 space-y-3">
          {form.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">
                {index + 1}
              </span>
              <input
                value={option}
                disabled={existingVotes > 0}
                onChange={(event) => setOption(index, event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              {form.options.length > 2 && existingVotes === 0 && (
                <button type="button" onClick={() => removeOption(index)} className="grid h-10 w-10 place-items-center rounded-xl text-rose-500 hover:bg-rose-50">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          {form.options.length < 6 && existingVotes === 0 && (
            <button type="button" onClick={addOption} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50">
              <Plus size={16} /> Add option
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Status</FieldLabel>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400">
              <option value="draft">Draft</option>
              <option value="scheduled">Schedule / publish</option>
              <option value="live">Live now</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div>
            <FieldLabel>Publish at</FieldLabel>
            <input type="datetime-local" value={form.publishAt} onChange={(event) => setForm((current) => ({ ...current, publishAt: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400" />
          </div>
          <div>
            <FieldLabel>Expires at</FieldLabel>
            <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400" />
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-violet-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => navigate("/admin/polls")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-violet-700 disabled:opacity-50">
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
            {editing ? "Save Poll" : "Create Poll"}
          </button>
        </div>
      </section>
    </>
  );
}

export default AdminPollEditorPage;
