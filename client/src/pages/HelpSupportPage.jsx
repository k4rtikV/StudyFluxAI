import {
  BookOpenCheck,
  ChevronDown,
  CircleHelp,
  Mail,
  MessageCircleQuestion,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { getSupportConfig, sendSupportRequest } from "../services/supportService";

const FAQS = [
  ["How are FluxGems used?", "FluxGems are StudyFluxAI's spendable AI currency. Generators, Tutor usage after the free allowance and Smart Interview can spend FluxGems; rewards and purchases are recorded in your wallet ledger."],
  ["Where are my generated notes and quizzes?", "Open Study Library. Completed notes, quizzes and combined sessions share one recoverable history, including Tutor-saved quiz entries."],
  ["Why did Astra continue without voice?", "Smart Interview keeps the visible question usable when TTS is slow or temporarily unavailable. Your answer can still be recorded and evaluated from the visible prompt."],
  ["Can I change the learning profile used by AI?", "Edit your learner profile from Profile. Smart Interview also lets you explicitly exclude learner-profile context for an individual interview."],
  ["How do notification emails work?", "Optional announcement, community and reward emails can be enabled or disabled from Settings. Security and verification emails remain separate."],
  ["What should I include in a support request?", "Include what you were trying to do, the page/feature, the visible error, and whether retrying changed anything. Never send passwords, OTPs or payment secrets."],
];

function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ category: "technical", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSupportConfig()
      .then((response) => setConfig(response.data))
      .catch(() => setConfig({ supportFormEnabled: true, supportResponseSlaHours: 48 }));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      const response = await sendSupportRequest(form);
      toast.success(response.message || "Support request sent.");
      setForm({ category: "technical", subject: "", message: "" });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not send your support request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-8">
      <section className="mb-6 overflow-hidden rounded-[30px] border border-cyan-200/70 bg-[linear-gradient(120deg,rgba(255,255,255,0.97),rgba(236,254,255,0.9),rgba(238,242,255,0.88))] px-6 py-7 shadow-[0_20px_55px_rgba(8,145,178,0.08)] sm:px-8">
        <div className="flex items-center gap-2 text-cyan-700"><CircleHelp size={17} /><span className="text-[11px] font-black uppercase tracking-[0.15em]">Help & Support</span></div>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Find an answer or contact us.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Start with the most common StudyFluxAI questions. If something is still wrong, send a support request directly to the configured administrator inbox.</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><MessageCircleQuestion size={20} /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">FAQ</p><h2 className="text-xl font-black text-slate-900">Common questions</h2></div>
          </div>
          <div className="mt-5 space-y-2.5">
            {FAQS.map(([question, answer], index) => {
              const open = openFaq === index;
              return (
                <div key={question} className={`overflow-hidden rounded-2xl border transition ${open ? "border-violet-200 bg-violet-50/45" : "border-slate-200 bg-white"}`}>
                  <button type="button" onClick={() => setOpenFaq(open ? -1 : index)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="min-w-0 flex-1 text-sm font-black text-slate-800">{question}</span>
                    <ChevronDown size={17} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && <p className="border-t border-violet-100 px-4 py-4 text-sm leading-6 text-slate-600">{answer}</p>}
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Mail size={20} /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Contact support</p><h2 className="text-xl font-black text-slate-900">Email the administrator</h2></div>
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-xs leading-5 text-cyan-800">
            Your request is emailed directly to the StudyFluxAI support inbox. Response target: about {Number(config?.supportResponseSlaHours || 48)} hours.
          </div>

          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

          {config?.supportFormEnabled === false ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-800">The in-app support form is temporarily disabled. Please try again later.</div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Category</span><select value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300"><option value="technical">Technical issue</option><option value="account">Account</option><option value="billing">Billing / FluxGems</option><option value="generation">AI generation</option><option value="interview">Smart Interview</option><option value="feedback">Feedback</option><option value="other">Other</option></select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Subject</span><input value={form.subject} onChange={(e) => setForm((c) => ({ ...c, subject: e.target.value }))} maxLength={160} required placeholder="What do you need help with?" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-cyan-300" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Message</span><textarea value={form.message} onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))} maxLength={5000} required rows={8} placeholder="Describe what happened, what you expected, and any error you saw. Do not include passwords or OTPs." className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-cyan-300" /></label>
              <div className="flex items-center justify-between gap-4"><p className="text-[11px] font-semibold text-slate-400">Maximum 3 requests per hour.</p><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 disabled:opacity-60"><Send size={16} /> {submitting ? "Sending..." : "Send request"}</button></div>
            </form>
          )}
        </article>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {[ [BookOpenCheck, "Study Library", "Generated learning material stays recoverable in your Study Library."], [Sparkles, "AI reliability", "Retry controls and saved state protect longer AI workflows where possible."], [ShieldCheck, "Account safety", "StudyFluxAI support will never ask for your password, OTP or payment secret."] ].map(([Icon,title,text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white/85 p-4"><Icon size={18} className="text-violet-600" /><p className="mt-3 text-sm font-black text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}
      </section>
    </div>
  );
}

export default HelpSupportPage;
