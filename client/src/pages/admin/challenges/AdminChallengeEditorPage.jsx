import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import {
  createAdminChallenge,
  generateAdminChallengeDraft,
  getAdminChallenges,
  updateAdminChallenge,
} from "../../../services/adminCommunityService";
import {
  emptyChallengeForm,
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

function AdminChallengeEditorPage() {
  const navigate = useNavigate();
  const { challengeId } = useParams();
  const editing = Boolean(challengeId);
  const [form, setForm] = useState(emptyChallengeForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("medium");

  useEffect(() => {
    if (!editing) return;

    const load = async () => {
      try {
        setLoading(true);
        const response = await getAdminChallenges();
        const challenge = (response.data?.challenges || []).find(
          (item) => item.id === challengeId,
        );
        if (!challenge) {
          toast.error("Challenge not found.");
          navigate("/admin/challenges", { replace: true });
          return;
        }

        setForm({
          question: challenge.question,
          options: challenge.options,
          correctOptionIndex: challenge.correctOptionIndex,
          category: challenge.category,
          difficulty: challenge.difficulty,
          explanation: challenge.explanation,
          xpReward: challenge.xpReward,
          fluxGemReward: challenge.fluxGemReward,
          status: challenge.status,
          publishAt: toAdminInputDate(challenge.publishAt),
          expiresAt: toAdminInputDate(challenge.expiresAt),
        });
      } catch (error) {
        toast.error(error?.response?.data?.message || "Could not load this challenge.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [challengeId, editing, navigate]);

  const setOption = (index, value) =>
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    }));

  const generateDraft = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Tell AI what challenge you want to create.");
      return;
    }

    const hasManualContent =
      Boolean(form.question.trim()) || form.options.some((option) => option.trim());
    if (
      hasManualContent &&
      !window.confirm(
        "Replace the current question, options and explanation with a new AI draft? Rewards and publishing settings will stay unchanged.",
      )
    ) {
      return;
    }

    try {
      setAiGenerating(true);
      const response = await generateAdminChallengeDraft({
        prompt: aiPrompt.trim(),
        category: aiCategory.trim(),
        difficulty: aiDifficulty,
      });
      const draft = response.data?.draft;
      const meta = response.data?.meta;

      if (!draft) throw new Error("AI returned no challenge draft.");

      setForm((current) => ({
        ...current,
        question: draft.question,
        options: draft.options,
        correctOptionIndex: draft.correctOptionIndex,
        category: draft.category,
        difficulty: draft.difficulty,
        explanation: draft.explanation,
      }));
      setAiCategory(draft.category);
      setAiDifficulty(draft.difficulty);

      toast.success(
        meta?.fallbackUsed
          ? "AI challenge draft ready using the fallback model. Review it before publishing."
          : "AI challenge draft ready. Review it before publishing.",
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Could not generate an AI challenge draft.",
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = toAdminApiPayload(form);
      if (editing) await updateAdminChallenge(challengeId, payload);
      else await createAdminChallenge(payload);
      toast.success(editing ? "Challenge updated." : "Challenge created.");
      navigate("/admin/challenges", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save this challenge.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <LoaderCircle className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Daily Challenges"
        title={editing ? "Edit Challenge" : "Create Challenge"}
        description={
          editing
            ? "Update the universal question, answer key, learning rewards and publishing window. The correct answer stays server-side until a learner submits."
            : "Create manually or start from an AI draft, then review the answer key, rewards and publishing window before anything goes live."
        }
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/challenges")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            <ArrowLeft size={16} /> Back to challenges
          </button>
        }
      />

      {!editing && (
        <section className="mb-5 overflow-hidden rounded-[28px] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 shadow-[0_18px_45px_rgba(79,70,229,0.08)]">
          <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-indigo-600">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Sparkles size={16} />
                </span>
                Admin AI Challenge Generator
              </div>
              <h2 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">
                Start with a Gemini draft, keep the final decision yours.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Describe the concept you want to test. AI drafts one four-option challenge and its explanation; rewards, schedule and publishing status are never auto-filled or auto-published.
              </p>

              <div className="mt-4">
                <FieldLabel>What should AI create?</FieldLabel>
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Example: A medium operating systems challenge about deadlock prevention that tests understanding rather than memorization."
                  className="w-full rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/55"
                />
                <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
                  {aiPrompt.length}/800
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div>
                  <FieldLabel>Category hint</FieldLabel>
                  <input
                    value={aiCategory}
                    onChange={(event) => setAiCategory(event.target.value)}
                    maxLength={80}
                    placeholder="Optional — e.g. Biology"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <FieldLabel>Difficulty</FieldLabel>
                  <select
                    value={aiDifficulty}
                    onChange={(event) => setAiDifficulty(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={aiGenerating}
                onClick={generateDraft}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_25px_rgba(79,70,229,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                {aiGenerating ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                {aiGenerating ? "Drafting challenge..." : "Generate AI Draft"}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium leading-5 text-slate-500">
                AI output stays editable and unsaved until you click Create Challenge below.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[30px] border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/40 to-cyan-50/45 p-5 shadow-[0_20px_50px_rgba(16,185,129,0.07)] sm:p-7">
        <div>
          <FieldLabel>Question</FieldLabel>
          <textarea
            value={form.question}
            onChange={(event) =>
              setForm((current) => ({ ...current, question: event.target.value }))
            }
            rows={4}
            placeholder="Which planet has the shortest day?"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100/45"
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {form.options.map((option, index) => (
            <div key={index}>
              <FieldLabel>Option {String.fromCharCode(65 + index)}</FieldLabel>
              <div className="flex gap-2">
                <input
                  value={option}
                  onChange={(event) => setOption(index, event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100/40"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, correctOptionIndex: index }))
                  }
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
                    Number(form.correctOptionIndex) === index
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300"
                  }`}
                  title="Mark as correct"
                >
                  <CheckCircle2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <FieldLabel>Category</FieldLabel>
            <input
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <FieldLabel>Difficulty</FieldLabel>
            <select
              value={form.difficulty}
              onChange={(event) =>
                setForm((current) => ({ ...current, difficulty: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <FieldLabel>XP reward</FieldLabel>
            <input
              type="number"
              min="0"
              max="1000"
              value={form.xpReward}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  xpReward: Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <FieldLabel>FluxGem reward</FieldLabel>
            <input
              type="number"
              min="0"
              max="500"
              value={form.fluxGemReward}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fluxGemReward: Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>Explanation shown after answering</FieldLabel>
          <textarea
            value={form.explanation}
            onChange={(event) =>
              setForm((current) => ({ ...current, explanation: event.target.value }))
            }
            rows={4}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400"
            placeholder="Explain why the correct answer is correct."
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Publish status</FieldLabel>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-emerald-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/admin/challenges")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {editing ? "Save Challenge" : "Create Challenge"}
          </button>
        </div>
      </section>
    </>
  );
}

export default AdminChallengeEditorPage;
