import {
  Archive,
  Pencil,
  BellRing,
  Mail,
  Megaphone,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import {
  archiveAdminAnnouncement,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  getAdminAnnouncements,
  publishAdminAnnouncement,
} from "../../services/adminAnnouncementService";
import { getAdminSettings } from "../../services/adminSettingsService";

const emptyForm = {
  title: "",
  body: "",
  priority: "normal",
  actionLabel: "",
  actionUrl: "",
  emailDelivery: false,
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not published";

function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [defaultEmailDelivery, setDefaultEmailDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [response, settingsResponse] = await Promise.all([
        getAdminAnnouncements(),
        getAdminSettings().catch(() => null),
      ]);
      setItems(response.data.announcements || []);
      const emailDefault = Boolean(settingsResponse?.data?.announcementEmailDefault);
      setDefaultEmailDelivery(emailDefault);
      if (!editingId) {
        setForm((current) => ({ ...current, emailDelivery: current.title || current.body ? current.emailDelivery : emailDefault }));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(
    () => ({
      drafts: items.filter((item) => item.status === "draft").length,
      published: items.filter((item) => item.status === "published").length,
      recipients: items.reduce((sum, item) => sum + Number(item.recipientCount || 0), 0),
    }),
    [items],
  );

  const submit = async (publishNow) => {
    try {
      setSubmitting(true);
      setError("");
      if (editingId) {
        await updateAdminAnnouncement(editingId, form);
        if (publishNow) await publishAdminAnnouncement(editingId);
      } else {
        await createAdminAnnouncement({ ...form, publishNow });
      }
      setEditingId(null);
      setForm({ ...emptyForm, emailDelivery: defaultEmailDelivery });
      toast.success(publishNow ? "Announcement published." : editingId ? "Draft updated." : "Announcement saved as draft.");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not save the announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action, successMessage) => {
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (requestError) {
      toast.error(requestError?.response?.data?.message || "Announcement action failed.");
    }
  };

  const editDraft = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      body: item.body || "",
      priority: item.priority || "normal",
      actionLabel: item.actionLabel || "",
      actionUrl: item.actionUrl || "",
      emailDelivery: Boolean(item.emailDelivery),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...emptyForm, emailDelivery: defaultEmailDelivery });
  };

  return (
    <div className="pb-8">
      <AdminPageHeader
        eyebrow="Learner communications"
        title="Announcements"
        description="Publish persistent in-app updates to learners and optionally deliver the same message by email to users who opted in."
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Drafts", stats.drafts, "text-amber-700 bg-amber-50"],
          ["Published", stats.published, "text-emerald-700 bg-emerald-50"],
          ["In-app recipients", stats.recipients, "text-cyan-700 bg-cyan-50"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-black ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Megaphone size={20} /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">Compose</p><h2 className="text-xl font-black text-slate-900">{editingId ? "Edit draft" : "New announcement"}</h2></div>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

          <div className="mt-5 space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Title</span><input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} maxLength={180} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300" placeholder="Short, clear learner-facing title" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Message</span><textarea value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} maxLength={3000} rows={7} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-violet-300" placeholder="What should learners know?" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Priority</span><select value={form.priority} onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">Action label</span><input value={form.actionLabel} onChange={(e) => setForm((c) => ({ ...c, actionLabel: e.target.value }))} maxLength={80} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" placeholder="e.g. Open Planner" /></label>
            </div>
            <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-500">In-app action path</span><input value={form.actionUrl} onChange={(e) => setForm((c) => ({ ...c, actionUrl: e.target.value }))} maxLength={500} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" placeholder="/planner (optional)" /></label>
            <label className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3"><input type="checkbox" checked={form.emailDelivery} onChange={(e) => setForm((c) => ({ ...c, emailDelivery: e.target.checked }))} className="h-4 w-4 accent-cyan-600" /><div><p className="text-sm font-black text-slate-800">Also send by email</p><p className="text-xs leading-5 text-slate-500">Only opted-in learners receive email; everyone with announcements enabled in-app gets the notification.</p></div></label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {editingId && <button type="button" disabled={submitting} onClick={cancelEdit} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-500">Cancel edit</button>}
              <button type="button" disabled={submitting} onClick={() => submit(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50"><Plus size={16} /> {editingId ? "Update draft" : "Save draft"}</button>
              <button type="button" disabled={submitting} onClick={() => submit(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-100 disabled:opacity-50"><Send size={16} /> {submitting ? "Working..." : "Publish now"}</button>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><BellRing size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">History</p><h2 className="text-xl font-black text-slate-900">Announcement log</h2></div></div>
          <div className="sf-scrollbar mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {loading ? <p className="py-12 text-center text-sm font-semibold text-slate-400">Loading announcements...</p> : items.length ? items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${item.status === "published" ? "bg-emerald-100 text-emerald-700" : item.status === "archived" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{item.status}</span><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700">{item.priority}</span>{item.emailDelivery && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-[9px] font-black uppercase text-cyan-700"><Mail size={10} /> email</span>}</div><h3 className="mt-2 text-sm font-black text-slate-900">{item.title}</h3><p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{item.body}</p></div></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3"><p className="text-[10px] font-semibold text-slate-400">{item.status === "published" ? `Published ${formatDate(item.publishedAt)} · ${item.recipientCount} in-app · ${item.emailSentCount} email` : `Created ${formatDate(item.createdAt)}`}</p><div className="flex gap-2">{item.status === "draft" && <><button onClick={() => editDraft(item)} className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700" title="Edit draft"><Pencil size={14} /></button><button onClick={() => runAction(() => publishAdminAnnouncement(item.id), "Announcement published.")} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700" title="Publish"><Send size={14} /></button><button onClick={() => runAction(() => deleteAdminAnnouncement(item.id), "Draft deleted.")} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700" title="Delete draft"><Trash2 size={14} /></button></>}{item.status === "published" && <button onClick={() => runAction(() => archiveAdminAnnouncement(item.id), "Announcement archived.")} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600" title="Archive"><Archive size={14} /></button>}</div></div>
              </div>
            )) : <p className="rounded-2xl bg-slate-50 py-12 text-center text-sm font-semibold text-slate-400">No announcements yet.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

export default AdminAnnouncementsPage;
