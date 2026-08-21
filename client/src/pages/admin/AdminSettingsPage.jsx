import { Mail, Save, Settings, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { getAdminSettings, updateAdminSettings } from "../../services/adminSettingsService";

const Toggle = ({ checked, onChange }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition ${checked ? "border-emerald-400 bg-emerald-400" : "border-slate-300 bg-slate-200"}`}><span className={`h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} /></button>;

function AdminSettingsPage() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminSettings().then((response) => setForm(response.data)).catch((requestError) => setError(requestError?.response?.data?.message || "Could not load admin settings.")).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      setSaving(true); setError("");
      const response = await updateAdminSettings(form);
      setForm(response.data);
      toast.success("Admin settings saved.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not save admin settings.");
    } finally { setSaving(false); }
  };

  if (loading || !form) return <div className="grid min-h-[55vh] place-items-center text-sm font-semibold text-slate-500">Loading admin settings...</div>;

  return <div className="pb-8">
    <AdminPageHeader eyebrow="Operations" title="Admin Settings" description="Configure learner-support delivery and platform-wide communication defaults without exposing API keys or deployment secrets." />
    {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
    <section className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Mail size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Support</p><h2 className="text-xl font-black text-slate-900">Learner support inbox</h2></div></div>
        <div className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Support inbox email</span><input value={form.supportEmail || ""} onChange={(e) => setForm((c) => ({ ...c, supportEmail: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-300" placeholder="support@example.com" /><span className="mt-1.5 block text-[11px] leading-5 text-slate-400">The real mailbox that receives learner support requests. It may be the same verified mailbox used as your Brevo sender; replies are addressed to the learner automatically.</span></label><label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Response target (hours)</span><input type="number" min="1" max="168" value={form.supportResponseSlaHours} onChange={(e) => setForm((c) => ({ ...c, supportResponseSlaHours: Number(e.target.value) }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3"><div><p className="text-sm font-black text-slate-800">In-app support form</p><p className="mt-1 text-xs text-slate-500">Allow learners to send support requests from Help & Support.</p></div><Toggle checked={form.supportFormEnabled} onChange={(value) => setForm((c) => ({ ...c, supportFormEnabled: value }))} /></div></div>
      </article>
      <article className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><Users size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Communications</p><h2 className="text-xl font-black text-slate-900">Email delivery defaults</h2></div></div>
        <div className="mt-5 space-y-3">{[["emailDeliveryEnabled","Master email delivery","Allow optional notification emails to leave StudyFluxAI."],["announcementEmailDefault","Announcement email default","Preselect email delivery when an admin composes a new announcement."],["communityEmailEnabled","Challenge & poll email delivery","Email opted-in learners when scheduled/live community content goes live."]].map(([key,title,desc]) => <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3"><div><p className="text-sm font-black text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p></div><Toggle checked={Boolean(form[key])} onChange={(value) => setForm((c) => ({ ...c, [key]: value }))} /></div>)}</div>
        <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/55 px-4 py-3 text-xs leading-5 text-violet-800"><ShieldCheck size={14} className="mr-1 inline" /> API keys, sender credentials and payment secrets remain environment-only and are never editable from this screen.</div>
      </article>
    </section>
    <div className="mt-5 flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 disabled:opacity-60"><Save size={16} /> {saving ? "Saving..." : "Save admin settings"}</button></div>
  </div>;
}

export default AdminSettingsPage;
