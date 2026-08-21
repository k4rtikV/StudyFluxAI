import {
  AlarmClock,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Flag,
  Lightbulb,
  Link2,
  LoaderCircle,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import {
  createStudyPlan,
  deleteStudyPlan,
  findStudyPlannerMatches,
  listStudyPlans,
  updateStudyPlan,
} from "../services/studyPlannerService";
import { listStudySessions } from "../services/studySessionService";
import { emitStudyPlannerChanged } from "../utils/studyPlannerEvents";

const PRIORITY_META = {
  low: {
    label: "Low priority",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
  medium: {
    label: "Medium priority",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  high: {
    label: "High priority",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
};

const STATUS_META = {
  planned: {
    label: "Planned",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
  in_progress: {
    label: "In progress",
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  completed: {
    label: "Completed",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const TYPE_META = {
  combined: { label: "Notes + Quiz", badgeLabel: "Study Session", Icon: Sparkles, className: "text-indigo-600 bg-indigo-50" },
  notes: { label: "AI Notes", badgeLabel: "Notes", Icon: NotebookPen, className: "text-cyan-600 bg-cyan-50" },
  quiz: { label: "AI Quiz", badgeLabel: "Quiz", Icon: Lightbulb, className: "text-violet-600 bg-violet-50" },
};

const emptyForm = () => ({
  title: "",
  topic: "",
  goal: "",
  targetAt: "",
  durationMinutes: 60,
  priority: "medium",
  status: "planned",
});

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const toLocalInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatTarget = (value) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatDuration = (minutes) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${mins} min`;
};

const getLibraryItemTitle = (item) => item.title || item.topic || "Learning item";

function LibraryItemButton({ item, selected, onToggle, compact = false }) {
  const meta = TYPE_META[item.generationType || "combined"] || TYPE_META.combined;
  const Icon = meta.Icon;

  return (
    <button
      type="button"
      onClick={() => onToggle(String(item.id))}
      className={`group flex w-full items-center gap-3 rounded-2xl border text-left transition ${
        compact ? "p-3" : "p-3.5"
      } ${
        selected
          ? "border-violet-300 bg-violet-50/80 shadow-[0_8px_22px_rgba(124,58,237,0.09)]"
          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/35"
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.className}`}>
        <Icon size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-slate-900">
          {getLibraryItemTitle(item)}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
          {meta.label}{item.origin === "ai_tutor" ? " · Made with AI Tutor" : ""}
        </span>
      </span>

      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
          selected
            ? "border-violet-500 bg-violet-500 text-white"
            : "border-slate-200 bg-white text-transparent group-hover:border-violet-300"
        }`}
      >
        <Check size={13} />
      </span>
    </button>
  );
}

function StudyPlanModal({ open, plan, onClose, onSaved }) {
  const isEditing = Boolean(plan?.id);
  const [form, setForm] = useState(emptyForm());
  const [selectedIds, setSelectedIds] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (plan) {
      setForm({
        title: plan.title || "",
        topic: plan.topic || "",
        goal: plan.goal || "",
        targetAt: toLocalInputValue(plan.targetAt),
        durationMinutes: Number(plan.durationMinutes || 60),
        priority: plan.priority || "medium",
        status: plan.status || "planned",
      });
      setSelectedIds((plan.linkedStudySessions || []).map((item) => String(item.id)));
    } else {
      setForm(emptyForm());
      setSelectedIds([]);
    }

    setSuggestions([]);
    setBrowseOpen(false);
    setLibrarySearch("");
  }, [open, plan]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const loadLibrary = async () => {
      try {
        setLibraryLoading(true);
        const response = await listStudySessions(50);
        if (active) setLibraryItems(response?.data?.studySessions || []);
      } catch {
        if (active) setLibraryItems([]);
      } finally {
        if (active) setLibraryLoading(false);
      }
    };

    loadLibrary();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const topic = form.topic.trim();
    const title = form.title.trim();

    if (topic.length < 2 && title.length < 2) {
      setSuggestions([]);
      setMatchesLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setMatchesLoading(true);
        const response = await findStudyPlannerMatches({
          topic,
          title,
          goal: form.goal,
        });
        if (active) setSuggestions(response?.data?.suggestions || []);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setMatchesLoading(false);
      }
    }, 650);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.goal, form.title, form.topic, open]);

  if (!open) return null;

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(0, 12),
    );
  };

  const filteredLibrary = libraryItems.filter((item) => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return true;
    return `${item.title || ""} ${item.topic || ""} ${item.description || ""}`.toLowerCase().includes(query);
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.targetAt) {
      toast.error("Choose a target date and time.");
      return;
    }

    const targetDate = new Date(form.targetAt);
    if (Number.isNaN(targetDate.getTime())) {
      toast.error("Choose a valid target date and time.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      topic: form.topic.trim(),
      goal: form.goal.trim(),
      targetAt: targetDate.toISOString(),
      durationMinutes: Number(form.durationMinutes),
      priority: form.priority,
      ...(isEditing ? { status: form.status } : {}),
      linkedStudySessionIds: selectedIds,
    };

    try {
      setSaving(true);
      const response = isEditing
        ? await updateStudyPlan(plan.id, payload)
        : await createStudyPlan(payload);
      toast.success(isEditing ? "Study plan updated." : "Study plan created.");
      onSaved(response?.data?.studyPlan);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Study plan could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5">
      <div className="sf-scrollbar max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-white/80 bg-[#fbfcff] shadow-[0_32px_90px_rgba(15,23,42,0.24)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
              {isEditing ? "Edit study plan" : "Plan your next study block"}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {isEditing ? "Update your goal" : "Create a study plan"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label="Close study planner editor"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Plan title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. JavaScript async revision"
                maxLength={160}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Topic</span>
              <input
                value={form.topic}
                onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}
                placeholder="e.g. Promises, async/await, event loop"
                maxLength={180}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Goal</span>
            <textarea
              value={form.goal}
              onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
              placeholder="What do you want to be able to understand, revise or complete?"
              maxLength={600}
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <div className={`mt-4 grid gap-4 ${isEditing ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Target date & time</span>
              <input
                type="datetime-local"
                value={form.targetAt}
                onChange={(event) => setForm((current) => ({ ...current, targetAt: event.target.value }))}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Duration</span>
              <select
                value={form.durationMinutes}
                onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              >
                {[30, 45, 60, 90, 120, 180].map((value) => (
                  <option key={value} value={value}>{formatDuration(value)}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            {isEditing && (
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            )}
          </div>

          <section className="mt-6 rounded-3xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-cyan-50/55 to-emerald-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-violet-700">
                  <Sparkles size={17} />
                  <p className="text-sm font-black">Smart Study Library matches</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  StudyFluxAI matches your topic locally using titles, topics and learning metadata. No Gemini request is used.
                </p>
              </div>
              <span className="w-fit rounded-full border border-white/90 bg-white/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                {selectedIds.length}/12 attached
              </span>
            </div>

            <div className="mt-4">
              {matchesLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-white/90 bg-white/65 px-4 py-4 text-sm font-semibold text-slate-500">
                  <LoaderCircle size={17} className="animate-spin text-violet-600" />
                  Checking your Study Library...
                </div>
              ) : suggestions.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {suggestions.map((item) => (
                    <LibraryItemButton
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(String(item.id))}
                      onToggle={toggleSelected}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white bg-white/52 px-4 py-4 text-sm leading-6 text-slate-500">
                  {form.topic.trim() || form.title.trim()
                    ? "No strong related matches yet. You can still attach any saved item manually."
                    : "Enter a topic and StudyFluxAI will suggest related saved notes, quizzes and sessions."}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setBrowseOpen((current) => !current)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/90 bg-white/78 px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition hover:bg-white"
            >
              <BookOpenCheck size={15} />
              Add from Study Library
              <ChevronDown size={14} className={`transition ${browseOpen ? "rotate-180" : ""}`} />
            </button>

            {browseOpen && (
              <div className="mt-3 rounded-2xl border border-white/90 bg-white/74 p-3">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                    placeholder="Search your Study Library"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-300"
                  />
                </div>

                <div className="sf-scrollbar mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {libraryLoading ? (
                    <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-500">
                      <LoaderCircle size={16} className="animate-spin" /> Loading Study Library...
                    </div>
                  ) : filteredLibrary.length ? (
                    filteredLibrary.map((item) => (
                      <LibraryItemButton
                        key={item.id}
                        item={item}
                        selected={selectedIds.includes(String(item.id))}
                        onToggle={toggleSelected}
                        compact
                      />
                    ))
                  ) : (
                    <p className="px-2 py-4 text-sm text-slate-500">No matching Library items.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarCheck2 size={16} />}
              {saving ? "Saving..." : isEditing ? "Save changes" : "Create study plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudyPlannerPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [busyPlanId, setBusyPlanId] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const loadPlans = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const response = await listStudyPlans();
      setPlans(response?.data?.studyPlans || []);
    } catch (error) {
      if (!quiet) {
        toast.error(getErrorMessage(error, "Study Planner could not be loaded."));
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activePlans = plans.filter((plan) => plan.status !== "completed");
  const completedPlans = plans.filter((plan) => plan.status === "completed");
  const overduePlans = activePlans.filter((plan) => new Date(plan.targetAt).getTime() < now);
  const upcomingPlans = activePlans.filter((plan) => new Date(plan.targetAt).getTime() >= now);
  const linkedCount = activePlans.reduce((sum, plan) => sum + (plan.linkedStudySessions?.length || 0), 0);
  const scheduledMinutes = activePlans.reduce((sum, plan) => sum + Number(plan.durationMinutes || 0), 0);

  const displayedPlans = useMemo(() => {
    if (filter === "completed") return completedPlans;
    if (filter === "overdue") return overduePlans;
    if (filter === "all") return plans;
    return activePlans;
  }, [activePlans, completedPlans, filter, overduePlans, plans]);

  const openCreate = () => {
    setEditingPlan(null);
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setModalOpen(true);
  };

  const syncAfterMutation = async () => {
    emitStudyPlannerChanged();
    await loadPlans({ quiet: true });
  };

  const changeStatus = async (plan, status) => {
    try {
      setBusyPlanId(plan.id);
      await updateStudyPlan(plan.id, { status });
      toast.success(
        status === "completed"
          ? "Study goal completed. Nice work."
          : status === "in_progress"
            ? "Study plan started."
            : "Study plan moved back to planned.",
      );
      await syncAfterMutation();
    } catch (error) {
      toast.error(getErrorMessage(error, "Study plan could not be updated."));
    } finally {
      setBusyPlanId("");
    }
  };

  const continuePlan = (plan) => {
    const firstLinkedItem = plan.linkedStudySessions?.find((item) => item?.id);
    if (firstLinkedItem) {
      navigate(`/study/${firstLinkedItem.id}`);
      return;
    }

    toast("Attach Study Library material to give this plan a direct study path.");
    openEdit(plan);
  };

  const removePlan = async (plan) => {
    if (!window.confirm(`Delete “${plan.title}”? This will not delete linked Study Library items.`)) return;
    try {
      setBusyPlanId(plan.id);
      await deleteStudyPlan(plan.id);
      toast.success("Study plan deleted.");
      await syncAfterMutation();
    } catch (error) {
      toast.error(getErrorMessage(error, "Study plan could not be deleted."));
    } finally {
      setBusyPlanId("");
    }
  };

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-violet-600">
            <CalendarCheck2 size={18} />
            <p className="text-sm font-extrabold">Plan with what you already learned</p>
          </div>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-heading sm:text-4xl">Study Planner</h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Set focused goals, schedule study time and attach the most relevant Notes, Quizzes and Study Sessions already saved in your Library.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-200/60 transition hover:-translate-y-0.5"
        >
          <Plus size={18} />
          New study plan
        </button>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active plans", value: activePlans.length, helper: `${upcomingPlans.length} upcoming`, Icon: Target, className: "border-violet-200 text-violet-600 bg-violet-50" },
          { label: "Overdue", value: overduePlans.length, helper: overduePlans.length ? "Reschedule or finish these" : "Nothing waiting on you", Icon: AlarmClock, className: "border-rose-200 text-rose-600 bg-rose-50" },
          { label: "Scheduled time", value: formatDuration(scheduledMinutes), helper: "Across active study goals", Icon: Clock3, className: "border-cyan-200 text-cyan-600 bg-cyan-50" },
          { label: "Linked materials", value: linkedCount, helper: "Study Library items attached", Icon: Link2, className: "border-emerald-200 text-emerald-600 bg-emerald-50" },
        ].map(({ label, value, helper, Icon, className }) => (
          <article key={label} className="rounded-2xl border border-slate-200/80 bg-white/72 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</p>
                <p className="mt-1.5 text-2xl font-black text-slate-950">{value}</p>
              </div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl border ${className}`}><Icon size={19} /></span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/58 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">Your study schedule</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Study Library links stay connected to the original saved content — nothing is duplicated.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["active", "Active"],
              ["overdue", "Overdue"],
              ["completed", "Completed"],
              ["all", "All"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                  filter === value
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="mt-7 flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
            <LoaderCircle size={18} className="animate-spin text-violet-600" />
            Loading your study plans...
          </div>
        </div>
      ) : displayedPlans.length === 0 ? (
        <section className="mt-7 flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200 bg-white/60 px-6 text-center shadow-sm backdrop-blur-xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 via-cyan-100 to-emerald-100 text-violet-700">
            <CalendarDays size={25} />
          </div>
          <h2 className="mt-5 text-xl font-black text-slate-900">
            {filter === "active" ? "Plan your next focused study block" : "Nothing in this view yet"}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Add a topic and StudyFluxAI will locally suggest related material already sitting in your Study Library.
          </p>
          <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-violet-700">
            <Plus size={16} /> Create a plan
          </button>
        </section>
      ) : (
        <section className="mt-7 grid gap-5 xl:grid-cols-2">
          {displayedPlans.map((plan) => {
            const priority = PRIORITY_META[plan.priority] || PRIORITY_META.medium;
            const status = STATUS_META[plan.status] || STATUS_META.planned;
            const overdue = plan.status !== "completed" && new Date(plan.targetAt).getTime() < now;
            const busy = busyPlanId === plan.id;

            return (
              <article
                key={plan.id}
                className={`group rounded-3xl border p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 sm:p-6 ${
                  overdue
                    ? "border-rose-200/90 bg-gradient-to-br from-white via-white to-rose-50/60 shadow-[0_12px_34px_rgba(225,29,72,0.07)] hover:border-rose-300 hover:shadow-[0_20px_44px_rgba(225,29,72,0.11)]"
                    : "border-violet-200/80 bg-white/74 shadow-[0_12px_34px_rgba(15,23,42,0.06)] hover:border-violet-300 hover:bg-white/90 hover:shadow-[0_20px_44px_rgba(109,40,217,0.11)]"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${status.badge}`}>
                        {plan.status === "completed" ? <CheckCircle2 size={12} /> : plan.status === "in_progress" ? <Play size={12} /> : <CalendarDays size={12} />}
                        {status.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${priority.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                        {priority.label}
                      </span>
                      {overdue && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-rose-700">
                          <AlarmClock size={12} /> Overdue
                        </span>
                      )}
                    </div>
                    <h2 className="mt-4 text-xl font-black leading-7 text-slate-950">{plan.title}</h2>
                    <p className="mt-1 text-sm font-bold text-violet-600">{plan.topic}</p>
                    {plan.goal && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{plan.goal}</p>}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openEdit(plan)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:text-violet-600" aria-label="Edit study plan">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => removePlan(plan)} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" aria-label="Delete study plan">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className={`rounded-2xl border p-3.5 transition-colors ${overdue ? "border-rose-100 bg-rose-50/75" : "border-slate-100 bg-slate-50/70"}`}>
                    <div className={`flex items-center gap-2 ${overdue ? "text-rose-600" : "text-slate-500"}`}><CalendarCheck2 size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">{overdue ? "Overdue target" : "Target"}</span></div>
                    <p className={`mt-1.5 text-sm font-extrabold ${overdue ? "text-rose-700" : "text-slate-800"}`}>{formatTarget(plan.targetAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500"><Clock3 size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Duration</span></div>
                    <p className="mt-1.5 text-sm font-extrabold text-slate-800">{formatDuration(plan.durationMinutes)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-slate-500"><BookOpenCheck size={15} /><span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Materials</span></div>
                    <p className="mt-1.5 text-sm font-extrabold text-slate-800">{plan.linkedStudySessions?.length || 0} linked</p>
                  </div>
                </div>

                {plan.linkedStudySessions?.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50/70 via-white to-violet-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500"><Link2 size={14} /> Study material</div>
                    <div className="mt-2.5 space-y-2">
                      {plan.linkedStudySessions.slice(0, 4).map((item) => {
                        const meta = TYPE_META[item.generationType || "combined"] || TYPE_META.combined;
                        const Icon = item.origin === "ai_tutor" ? BrainCircuit : meta.Icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(`/study/${item.id}`)}
                            className="group/item flex w-full items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-3 py-2.5 text-left transition hover:bg-white"
                          >
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.className}`}><Icon size={15} /></span>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{getLibraryItemTitle(item)}</span>
                            <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] sm:inline-flex ${meta.className}`}>
                              {meta.badgeLabel}
                            </span>
                            {item.origin === "ai_tutor" && (
                              <span className="hidden shrink-0 rounded-full bg-fuchsia-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-fuchsia-600 lg:inline-flex">Tutor</span>
                            )}
                            <ArrowRight size={14} className="shrink-0 text-slate-300 transition group-hover/item:translate-x-0.5 group-hover/item:text-violet-500" />
                          </button>
                        );
                      })}
                      {plan.linkedStudySessions.length > 4 && <p className="px-1 text-xs font-semibold text-slate-400">+{plan.linkedStudySessions.length - 4} more attached</p>}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {plan.status === "planned" && (
                    <button type="button" disabled={busy} onClick={() => changeStatus(plan, "in_progress")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 disabled:opacity-60">
                      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />} Start plan
                    </button>
                  )}
                  {plan.status === "in_progress" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => continuePlan(plan)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 disabled:opacity-60">
                        <Play size={15} /> Continue plan
                      </button>
                      <button type="button" disabled={busy} onClick={() => changeStatus(plan, "completed")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-60">
                        {busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Mark complete
                      </button>
                    </>
                  )}
                  {plan.status === "completed" && (
                    <button type="button" disabled={busy} onClick={() => changeStatus(plan, "planned")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                      Reopen plan
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(plan)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
                    <Flag size={15} /> Reschedule / edit
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <StudyPlanModal
        open={modalOpen}
        plan={editingPlan}
        onClose={() => {
          setModalOpen(false);
          setEditingPlan(null);
        }}
        onSaved={async () => {
          emitStudyPlannerChanged();
          await loadPlans({ quiet: true });
        }}
      />
    </>
  );
}

export default StudyPlannerPage;
