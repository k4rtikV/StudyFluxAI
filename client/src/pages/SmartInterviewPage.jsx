import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Code2,
  FileText,
  Gem,
  GraduationCap,
  History,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import InterviewAudioPreflight from "../components/interview/InterviewAudioPreflight";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  getInterviewEligibility,
  listInterviews,
  startInterview,
} from "../services/interviewService";

const EDUCATION_LABELS = {
  class_7: "Class 7",
  class_8: "Class 8",
  class_9: "Class 9",
  class_10: "Class 10",
  class_11: "Class 11",
  class_12: "Class 12",
  diploma: "Diploma",
  bachelors: "Bachelor's / Undergraduate",
  masters: "Master's / Postgraduate",
  mba: "MBA",
  phd: "PhD / Doctorate",
  other: "Other",
};

const EXPERIENCE_OPTIONS = [
  ["fresher", "Student / Fresher"],
  ["entry", "Entry level"],
  ["junior", "Junior"],
  ["mid", "Mid level"],
  ["senior", "Senior"],
];

const TYPE_OPTIONS = [
  {
    value: "behavioral",
    label: "HR / Behavioral",
    description: "Communication, motivation and STAR-style responses.",
    icon: MessageSquareText,
  },
  {
    value: "technical",
    label: "Technical",
    description: "Concepts, correctness and technical reasoning.",
    icon: BrainCircuit,
  },
  {
    value: "coding",
    label: "Coding",
    description: "Problem solving, code-oriented reasoning and technical trade-offs.",
    icon: Code2,
  },
  {
    value: "mixed",
    label: "Mixed",
    description: "A balanced mock interview across multiple dimensions.",
    icon: Sparkles,
  },
];

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

const meaningfulTargetRole = (value) => {
  const role = String(value || "").trim().replace(/\s+/g, " ");
  const letters = Array.from(role.toLowerCase()).filter((char) => /\p{L}/u.test(char));
  if (role.length < 2 || letters.length < 2) return false;

  const compactLetters = letters.join("");
  if (/(.)\1{3,}/u.test(compactLetters)) return false;
  if (letters.length >= 5 && new Set(letters).size < 3) return false;
  return true;
};

const createStartRequestId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `interview-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function SmartInterviewPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [eligibility, setEligibility] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resume, setResume] = useState(null);
  const [readiness, setReadiness] = useState({
    audioReady: false,
    networkReady: false,
    ready: false,
    metrics: null,
  });
  const startRequestIdRef = useRef(null);
  const [form, setForm] = useState({
    targetRole: "",
    experienceLevel: "fresher",
    interviewType: "mixed",
    useLearnerProfile: true,
  });

  useEffect(() => {
    let active = true;
    Promise.all([getInterviewEligibility(), listInterviews()])
      .then(([eligibilityResponse, historyResponse]) => {
        if (!active) return;
        setEligibility(eligibilityResponse?.data || null);
        setHistory(historyResponse?.data?.interviews || []);
      })
      .catch((error) => {
        if (active) toast.error(errorMessage(error, "Smart Interview could not be loaded."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cost = Number(eligibility?.cost || 100);
  const balance = Number(user?.fluxGems ?? eligibility?.balance ?? 0);
  const canAfford = balance >= cost;
  const targetRoleValid = meaningfulTargetRole(form.targetRole);
  const targetRoleTouched = form.targetRole.trim().length > 0;
  const validSetup = targetRoleValid && form.experienceLevel && form.interviewType;
  const readyToStart = validSetup && readiness.ready;

  const selectedType = useMemo(
    () => TYPE_OPTIONS.find((option) => option.value === form.interviewType),
    [form.interviewType],
  );

  const updateForm = (updates) => {
    startRequestIdRef.current = null;
    setForm((current) => ({ ...current, ...updates }));
  };

  const scrollToPreflightTest = (targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 350);
  };

  const chooseResume = (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "text/plain", "text/markdown", "text/x-markdown"];
    if (!allowed.includes(file.type) && !/\.(pdf|txt|md|markdown)$/i.test(file.name)) {
      toast.error("Choose a PDF, TXT or Markdown resume.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Choose a resume smaller than 2 MB.");
      return;
    }
    startRequestIdRef.current = null;
    setResume(file);
  };

  const requestStart = () => {
    if (!validSetup) {
      toast.error(targetRoleValid ? "Complete the interview setup." : "Enter a real target role, for example Web Developer, QA Engineer or Game Developer.");
      return;
    }
    if (!readiness.audioReady) {
      toast.error("Complete the microphone test before starting.");
      return;
    }
    if (!readiness.networkReady) {
      toast.error("Complete the connection check before starting.");
      return;
    }
    if (!canAfford) {
      toast.error(`You need ${cost} FluxGems to start this interview.`);
      return;
    }
    if (!startRequestIdRef.current) {
      startRequestIdRef.current = createStartRequestId();
    }
    setConfirmOpen(true);
  };

  const confirmStart = async () => {
    setStarting(true);
    const startRequestId = startRequestIdRef.current || createStartRequestId();
    startRequestIdRef.current = startRequestId;
    try {
      const response = await startInterview({
        setup: { ...form, targetRole: form.targetRole.trim(), startRequestId },
        resume,
        readiness,
      });
      const nextBalance = Number(response?.data?.balance);
      if (Number.isFinite(nextBalance)) {
        setUser((current) => (current ? { ...current, fluxGems: nextBalance } : current));
      }
      startRequestIdRef.current = null;
      setConfirmOpen(false);
      toast.success(response?.message || "Smart Interview started.");
      navigate(`/interview/${response.data.interview.id}`);
    } catch (error) {
      if (error?.response?.status && error.response.status < 500) {
        startRequestIdRef.current = null;
      }
      toast.error(errorMessage(error, "The interview could not be started."));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[55vh] items-center justify-center text-sm font-bold text-slate-500">
          <LoaderCircle size={20} className="mr-2 animate-spin" /> Preparing Smart Interview...
        </div>
      </DashboardLayout>
    );
  }

  const eligible = Boolean(eligibility?.eligible);

  return (
    <DashboardLayout>
      <section className="overflow-hidden rounded-[32px] border border-violet-200/70 bg-[linear-gradient(120deg,rgba(255,255,255,0.96),rgba(245,243,255,0.94),rgba(236,254,255,0.88))] p-6 shadow-[0_22px_70px_rgba(79,70,229,0.10)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.13em] text-violet-700">
              <Sparkles size={14} /> Smart Interview
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Practice the interview, not just the answers.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Build a role-focused voice mock interview around your target role, experience level and preferred interview style. Your setup and readiness checks are saved as a persistent interview workspace.
            </p>
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3 rounded-3xl border border-white/80 bg-white/72 p-4 shadow-sm backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Interview cost</p>
              <div className="mt-2 flex items-center gap-2 text-xl font-black text-slate-900">
                <FluxGemMark size={25} /> {cost} FG
              </div>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Your balance</p>
              <p className={`mt-2 text-xl font-black ${canAfford ? "text-emerald-700" : "text-rose-600"}`}>{balance} FG</p>
            </div>
          </div>
        </div>
      </section>

      {!eligible ? (
        <section className="mt-6 rounded-[30px] border border-amber-200 bg-white/88 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200"><LockKeyhole size={24} /></span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-600">Eligibility locked</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Smart Interview is for undergraduate learners and above.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Your current learning profile is <strong>{EDUCATION_LABELS[eligibility?.educationLevel] || "not eligible"}</strong>. Eligibility is checked by the server, so changing the page UI cannot bypass it.
              </p>
              <button type="button" onClick={() => navigate("/profile/edit")} className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-amber-800 transition hover:bg-amber-100">
                Update learning profile <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
          <section className="rounded-[30px] border border-cyan-200/70 bg-white/88 p-5 shadow-[0_16px_50px_rgba(8,145,178,0.07)] sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"><BriefcaseBusiness size={20} /></span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-cyan-700">Interview setup</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">Choose what you want to practise</h2>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-extrabold text-slate-700">Target role</span>
                <input
                  value={form.targetRole}
                  onChange={(event) => updateForm({ targetRole: event.target.value })}
                  maxLength={100}
                  placeholder="e.g. MERN Stack Developer"
                  aria-invalid={targetRoleTouched && !targetRoleValid}
                  className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:ring-4 ${
                    targetRoleTouched && !targetRoleValid
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                  }`}
                />
                {targetRoleTouched && !targetRoleValid ? (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Enter a real job/role title, for example Web Developer, QA Engineer or Game Developer.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-400">Use the role you actually want Astra to interview you for.</p>
                )}
              </label>

              <label>
                <span className="text-sm font-extrabold text-slate-700">Experience level</span>
                <select value={form.experienceLevel} onChange={(event) => updateForm({ experienceLevel: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100">
                  {EXPERIENCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-slate-700">Learner profile scope</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.useLearnerProfile}
                    onClick={() => updateForm({ useLearnerProfile: !form.useLearnerProfile })}
                    className={`relative h-7 w-12 shrink-0 rounded-full border transition ${form.useLearnerProfile ? "border-emerald-300 bg-emerald-500" : "border-slate-300 bg-slate-200"}`}
                    title={form.useLearnerProfile ? "Learner profile included" : "Learner profile excluded"}
                  >
                    <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.useLearnerProfile ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className={`mt-2 flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 py-3 ${form.useLearnerProfile ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                  <GraduationCap size={18} className="shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{EDUCATION_LABELS[eligibility.educationLevel]}</p>
                    <p className="mt-0.5 text-[11px] font-semibold leading-4">{form.useLearnerProfile ? "Included as Astra interview context." : "Excluded from Astra's questions, evaluation and interview-linked Tutor deep dive."}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-slate-400">Your profile is still checked by the server only to verify Smart Interview eligibility.</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-extrabold text-slate-700">Interview type</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = form.interviewType === option.value;
                  return (
                    <button key={option.value} type="button" onClick={() => updateForm({ interviewType: option.value })} className={`rounded-2xl border p-4 text-left transition ${active ? "border-violet-400 bg-[linear-gradient(135deg,rgba(124,58,237,0.10),rgba(34,211,238,0.08))] shadow-sm" : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30"}`}>
                      <div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-violet-600 text-white" : "bg-slate-50 text-slate-500"}`}><Icon size={17} /></span><span className="font-extrabold text-slate-900">{option.label}</span></div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200"><FileText size={18} /></span>
                  <div><p className="text-sm font-extrabold text-slate-800">Optional resume</p><p className="mt-0.5 text-xs leading-5 text-slate-500">PDF, TXT or Markdown · max 2 MB. Stored with this mock-interview record for later interview grounding.</p></div>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
                  <Upload size={15} /> Choose file
                  <input type="file" accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" className="hidden" onChange={(event) => chooseResume(event.target.files?.[0])} />
                </label>
              </div>
              {resume && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><span className="truncate">{resume.name} · {(resume.size / 1024).toFixed(0)} KB</span><button type="button" onClick={() => { startRequestIdRef.current = null; setResume(null); }} aria-label="Remove resume" className="rounded-lg p-1 hover:bg-emerald-100"><X size={14} /></button></div>}
            </div>

            <InterviewAudioPreflight onChange={setReadiness} />
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-violet-200/80 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck size={19} /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-600">Ready check</p><h3 className="font-black text-slate-900">Review before charging</h3></div></div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="text-slate-500">Role</span><strong className={`text-right ${targetRoleTouched && !targetRoleValid ? "text-rose-600" : "text-slate-800"}`}>{form.targetRole.trim() || "Not set"}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Type</span><strong className="text-right text-slate-800">{selectedType?.label}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Learner profile</span><strong className={form.useLearnerProfile ? "text-emerald-700" : "text-slate-600"}>{form.useLearnerProfile ? "Included" : "Excluded"}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Resume</span><strong className="max-w-[170px] truncate text-right text-slate-800">{resume?.name || "None"}</strong></div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Microphone</span>
                  <div className="flex items-center gap-2">
                    <strong className={readiness.audioReady ? "text-emerald-700" : "text-amber-700"}>{readiness.audioReady ? "Ready" : "Test required"}</strong>
                    <button type="button" onClick={() => scrollToPreflightTest("smart-interview-mic-test")} className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-extrabold text-violet-700 transition hover:bg-violet-100">Test now</button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Internet</span>
                  <div className="flex items-center gap-2">
                    <strong className={readiness.networkReady ? "text-emerald-700" : "text-amber-700"}>{readiness.networkReady ? "Ready" : "Check required"}</strong>
                    <button type="button" onClick={() => scrollToPreflightTest("smart-interview-connection-test")} className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-extrabold text-cyan-800 transition hover:bg-cyan-100">Test now</button>
                  </div>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center justify-between"><span className="font-bold text-slate-600">Start cost</span><span className="inline-flex items-center gap-2 text-lg font-black text-violet-700"><FluxGemMark size={22} /> {cost} FG</span></div>
              </div>
              <button type="button" disabled={!readyToStart || !canAfford} onClick={requestStart} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-violet-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
                Start interview · {cost} FG <ArrowRight size={16} />
              </button>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">Nothing is charged while you configure this page. The debit happens only after the final confirmation.</p>
            </section>

            <section className="rounded-[28px] border border-emerald-200/80 bg-emerald-50/55 p-5">
              <div className="flex gap-3"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" /><div><p className="text-sm font-extrabold text-emerald-900">Voice-first mock interview</p><p className="mt-1 text-xs leading-5 text-emerald-800/75">No camera is required. You will answer interview questions by microphone. Raw test audio is not stored.</p></div></div>
            </section>
          </aside>
        </div>
      )}

      <section className="mt-6 rounded-[30px] border border-slate-200 bg-white/84 p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-600"><History size={18} /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">History</p><h2 className="text-xl font-black text-slate-900">Your mock interviews</h2></div></div>
        {history.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">No Smart Interviews yet. Your started sessions will appear here.</div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {history.map((item) => {
              const completed = item.status === "completed";
              const destination = completed
                ? `/interview/${item.id}/report`
                : `/interview/${item.id}`;

              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-extrabold text-slate-900">{item.targetRole}</p>
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700">{item.interviewType}</span>
                        {completed && item.overallScore !== null && item.overallScore !== undefined ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">{Number(item.overallScore)}/100</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(item.startedAt)} · {item.status.replace("_", " ")}</p>
                      {completed ? (
                        <p className="mt-2 text-[11px] leading-4 text-slate-400">{item.reportReady ? "Final report ready." : "Final report is being prepared in the background."}</p>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => navigate(destination)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 transition hover:border-violet-300 hover:text-violet-700">
                      {completed ? "View report" : "Continue"} <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !starting) setConfirmOpen(false); }}>
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">Final confirmation</p><h3 className="mt-2 text-2xl font-black text-slate-900">Start this mock interview?</h3></div><button type="button" disabled={starting} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={17} /></button></div>
            <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><p className="font-extrabold text-slate-900">{form.targetRole.trim()}</p><p className="mt-1 text-sm text-slate-600">{selectedType?.label} · {EXPERIENCE_OPTIONS.find(([value]) => value === form.experienceLevel)?.[1]}</p><p className="mt-2 text-xs font-bold text-violet-700">Learner profile: {form.useLearnerProfile ? "included in interview scope" : "excluded from interview scope"}</p></div>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-bold text-emerald-800">Microphone and connection checks passed. Your short microphone test remains local and is not uploaded.</div>
            <div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold text-slate-600">Charged once on start</span><span className="inline-flex items-center gap-2 text-lg font-black text-violet-700"><Gem size={18} /> {cost} FluxGems</span></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={starting} onClick={() => setConfirmOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" disabled={starting} onClick={confirmStart} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{starting ? <><LoaderCircle size={16} className="animate-spin" /> Starting...</> : <>Confirm & start <ArrowRight size={16} /></>}</button></div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default SmartInterviewPage;
