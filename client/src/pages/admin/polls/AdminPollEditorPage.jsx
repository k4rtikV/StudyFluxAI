import {
  ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import {
  createAdminPoll,
  generateAdminPollDraft,
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
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOptionCount, setAiOptionCount] = useState(4);
  const [aiGenerating, setAiGenerating] = useState(false);

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

  const generateDraft = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Tell AI what poll you want to create.");
      return;
    }

    const hasManualContent =
      Boolean(form.question.trim()) || form.options.some((option) => option.trim());
    if (
      hasManualContent &&
      !window.confirm(
        "Replace the current poll question and options with a new AI draft? Publishing settings will stay unchanged.",
      )
    ) {
      return;
    }

    try {
      setAiGenerating(true);
      const response = await generateAdminPollDraft({
        prompt: aiPrompt.trim(),
        optionCount: aiOptionCount,
      });
      const draft = response.data?.draft;
      const meta = response.data?.meta;

      if (!draft) throw new Error("AI returned no poll draft.");

      setForm((current) => ({
        ...current,
        question: draft.question,
        options: draft.options,
      }));

      toast.success(
        meta?.fallbackUsed
          ? "AI poll draft ready using the fallback model. Review it before publishing."
          : "AI poll draft ready. Review it before publishing.",
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Could not generate an AI poll draft.",
      );
    } finally {
      setAiGenerating(false);
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
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <LoaderCircle className="animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Community Polls"
        title={editing ? "Edit Poll" : "Create Poll"}
        description={
          editing
            ? "Update the community question and publishing window. Poll options are locked once voting begins."
            : "Create manually or start from an AI-generated community poll draft, then review every option before publishing."
        }
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

      {!editing && (
        <section className="mb-5 overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 shadow-[0_18px_45px_rgba(109,40,217,0.08)]">
          <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-violet-600">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
                  <Sparkles size={16} />
                </span>
                Admin AI Poll Generator
              </div>
              <h2 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">
                Turn a community topic into a neutral poll draft.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Describe what you want to learn from the community. AI drafts the question and options only; scheduling and publishing stay fully manual.
              </p>

              <div className="mt-4">
                <FieldLabel>What should AI ask the community?</FieldLabel>
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Example: Ask learners which study format helps them revise most effectively before exams."
                  className="w-full rounded-2xl border border-violet-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100/55"
                />
                <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
                  {aiPrompt.length}/800
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div>
                <FieldLabel>Number of options</FieldLabel>
                <select
                  value={aiOptionCount}
                  onChange={(event) => setAiOptionCount(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} options
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={aiGenerating}
                onClick={generateDraft}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_25px_rgba(109,40,217,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                {aiGenerating ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                {aiGenerating ? "Drafting poll..." : "Generate AI Draft"}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium leading-5 text-slate-500">
                AI creates no correct answer and never publishes automatically.
              </p>
            </div>
          </div>
        </section>
      )}

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
            onChange={(event) =>
              setForm((current) => ({ ...current, question: event.target.value }))
            }
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
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          {form.options.length < 6 && existingVotes === 0 && (
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50"
            >
              <Plus size={16} /> Add option
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Status</FieldLabel>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Schedule / publish</option>
              <option value="live">Live now</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div>
            <FieldLabel>Publish at</FieldLabel>
            <input
              type="datetime-local"
              value={form.publishAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, publishAt: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <FieldLabel>Expires at</FieldLabel>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiresAt: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-violet-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/admin/polls")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {editing ? "Save Poll" : "Create Poll"}
          </button>
        </div>
      </section>
    </>
  );
}

export default AdminPollEditorPage;
