import {
  BookOpenCheck,
  Check,
  ClipboardList,
  LoaderCircle,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const MODES = [
  {
    id: "standard",
    title: "Standard quiz",
    description: "Export only the quiz questions, answer key, grading and feedback.",
    icon: ClipboardList,
    points: ["Quiz questions", "Answer key", "Auto-grading"],
  },
  {
    id: "student_details",
    title: "Quiz + student details",
    description: "Collect learner details before the scored quiz begins.",
    icon: UserRoundCheck,
    points: ["Student name", "Class", "Division"],
  },
];

function GoogleFormsExportModal({ open, loading = false, onClose, onExport }) {
  const [mode, setMode] = useState("standard");

  useEffect(() => {
    if (open) setMode("standard");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/38 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-violet-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
              Google Forms export
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              How should this quiz be created?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Both options keep the StudyFluxAI answer key, points and automatic grading.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close Google Forms export options"
          >
            <X size={19} />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {MODES.map((item) => {
            const Icon = item.icon;
            const selected = mode === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                disabled={loading}
                className={`relative rounded-2xl border p-4 text-left transition duration-200 ${
                  selected
                    ? "border-violet-400 bg-[linear-gradient(145deg,rgba(238,242,255,0.94),rgba(236,254,255,0.88))] shadow-[0_14px_34px_rgba(79,70,229,0.10)]"
                    : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50/70"
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${
                    selected
                      ? "bg-gradient-to-br from-violet-100 to-cyan-100 text-violet-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon size={20} />
                </span>

                <span className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border border-slate-300 bg-white">
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> : null}
                </span>

                <span className="mt-4 block font-black text-slate-950">{item.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  {item.description}
                </span>

                <span className="mt-4 block space-y-1.5">
                  {item.points.map((point) => (
                    <span key={point} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Check size={14} className="text-emerald-500" />
                      {point}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {mode === "student_details" && (
          <div className="mx-5 mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/55 p-4 sm:mx-6 sm:mb-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-cyan-700">
              Student information
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Required, non-scored short-answer fields for <strong>Student name</strong>, <strong>Class</strong> and <strong>Division</strong> will be inserted before Question 1. They will also become separate columns in the linked response Sheet.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/65 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onExport(mode)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#6d28d9_0%,#4f46e5_42%,#06b6d4_72%,#10b981_100%)] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <BookOpenCheck size={16} />}
            {loading ? "Creating Google Form..." : "Create Google Form"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoogleFormsExportModal;
