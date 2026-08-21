import {
  Bell,
  Check,
  Clock3,
  Mail,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import useAuth from "../hooks/useAuth";
import { getUserSettings, updateUserSettings } from "../services/settingsService";
import { getBrowserTimeZone } from "../utils/timezone";

const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
      checked
        ? "border-emerald-400 bg-gradient-to-r from-emerald-400 to-cyan-400"
        : "border-slate-300 bg-slate-200"
    }`}
  >
    <span
      className={`h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform duration-200 ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const PreferenceRow = ({ icon: Icon, title, description, checked, onChange, tone = "violet" }) => {
  const tones = {
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.violet}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
};

function UserSettingsPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUserSettings()
      .then((response) => {
        if (!cancelled) setForm(response.data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || "Could not load your settings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateGroup = (group, key, value) => {
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      const response = await updateUserSettings(form);
      setForm(response.data);
      setUser((current) =>
        current
          ? {
              ...current,
              timezone: response.data.timezone,
              timezoneConfigured: Boolean(response.data.timezone),
            }
          : current,
      );
      toast.success("Settings saved.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not save your settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-violet-500" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <section className="mb-6 overflow-hidden rounded-[30px] border border-violet-200/70 bg-[linear-gradient(120deg,rgba(255,255,255,0.97),rgba(238,242,255,0.92),rgba(236,254,255,0.88))] px-6 py-7 shadow-[0_20px_55px_rgba(79,70,229,0.08)] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-600">
              <Settings2 size={16} />
              <span className="text-[11px] font-black uppercase tracking-[0.15em]">Learner settings</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Settings & preferences</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Control how StudyFluxAI contacts you and which updates appear in your notification panel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Save size={17} /> {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Bell size={20} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">In-app notifications</p>
              <h2 className="text-xl font-black text-slate-900">Notification panel</h2>
            </div>
          </div>
          <div className="mt-4">
            <PreferenceRow icon={Sparkles} title="Announcements" description="Platform announcements published by StudyFluxAI administrators." checked={form.notificationPreferences.announcements} onChange={(value) => updateGroup("notificationPreferences", "announcements", value)} />
            <PreferenceRow icon={Users} title="Community updates" description="New Daily Challenges and Community Polls when they go live." checked={form.notificationPreferences.community} onChange={(value) => updateGroup("notificationPreferences", "community", value)} tone="cyan" />
            <PreferenceRow icon={Trophy} title="FluxGem rewards" description="Welcome, level and other one-time reward notifications." checked={form.notificationPreferences.rewards} onChange={(value) => updateGroup("notificationPreferences", "rewards", value)} tone="emerald" />
            <PreferenceRow icon={ShieldCheck} title="System notices" description="Important account and platform notices. Recommended to keep enabled." checked={form.notificationPreferences.system} onChange={(value) => updateGroup("notificationPreferences", "system", value)} tone="amber" />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><Mail size={20} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">Email preferences</p>
              <h2 className="text-xl font-black text-slate-900">Optional email delivery</h2>
            </div>
          </div>
          <div className="mt-4">
            <PreferenceRow icon={Sparkles} title="Announcements" description="Receive admin announcements by email when the announcement includes email delivery." checked={form.emailPreferences.announcements} onChange={(value) => updateGroup("emailPreferences", "announcements", value)} />
            <PreferenceRow icon={Users} title="Community updates" description="Receive emails for newly live challenges and polls when the admin enables community email delivery." checked={form.emailPreferences.community} onChange={(value) => updateGroup("emailPreferences", "community", value)} tone="cyan" />
            <PreferenceRow icon={Trophy} title="Reward emails" description="Receive a lightweight email when one-time FluxGem rewards are granted." checked={form.emailPreferences.rewards} onChange={(value) => updateGroup("emailPreferences", "rewards", value)} tone="emerald" />
            <PreferenceRow icon={Mail} title="Support confirmations" description="Receive a reference email after you submit a Help & Support request." checked={form.emailPreferences.support} onChange={(value) => updateGroup("emailPreferences", "support", value)} tone="amber" />
          </div>
        </article>
      </section>

      <section className="mt-5 rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Clock3 size={20} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Timezone</p>
              <h2 className="text-lg font-black text-slate-900">Learning-day timezone</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Used for streak days, interview daily rewards and date-aware learner activity.</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={form.timezone || ""}
              onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              placeholder="e.g. Asia/Kolkata"
              className="h-11 min-w-[260px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            />
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, timezone: getBrowserTimeZone() }))}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
            >
              <RefreshCcw size={15} /> Use this device
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs font-semibold text-emerald-800">
        <Check size={15} /> Security-critical account emails are not controlled by optional marketing/learning preferences.
      </div>
    </div>
  );
}

export default UserSettingsPage;
