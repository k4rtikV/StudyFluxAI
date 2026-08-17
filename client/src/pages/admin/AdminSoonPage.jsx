import { BarChart3, Megaphone, Settings } from "lucide-react";

import AdminPageHeader from "../../components/admin/AdminPageHeader";

const config = {
  leaderboard: {
    title: "Leaderboard Management",
    eyebrow: "Coming next",
    description: "Configure leaderboard windows, review rankings and moderate competitive progression once the leaderboard phase is implemented.",
    icon: BarChart3,
    accent: "from-amber-50 via-white to-orange-50 border-amber-200 text-amber-700",
  },
  announcements: {
    title: "Announcements",
    eyebrow: "Coming next",
    description: "Publish learner-facing announcements and later connect optional Brevo email delivery to challenges, polls and platform updates.",
    icon: Megaphone,
    accent: "from-violet-50 via-white to-cyan-50 border-violet-200 text-violet-700",
  },
  settings: {
    title: "Admin Settings",
    eyebrow: "Coming next",
    description: "Platform-level admin preferences and operational controls will live here without mixing them into learner settings.",
    icon: Settings,
    accent: "from-slate-50 via-white to-emerald-50 border-slate-200 text-slate-700",
  },
};

function AdminSoonPage({ feature }) {
  const item = config[feature] || config.settings;
  const Icon = item.icon;

  return (
    <>
      <AdminPageHeader eyebrow={item.eyebrow} title={item.title} description={item.description} />
      <section className={`grid min-h-[430px] place-items-center rounded-[30px] border bg-gradient-to-br p-8 text-center shadow-[0_18px_44px_rgba(15,23,42,0.05)] ${item.accent}`}>
        <div className="max-w-xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-current/10 bg-white/75 shadow-sm">
            <Icon size={28} />
          </span>
          <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em]">StudyFluxAI roadmap</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Shell ready — feature coming later</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            This section already has a permanent place in the admin navigation, so the next implementation can be added without restructuring the console again.
          </p>
          <span className="mt-5 inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Soon
          </span>
        </div>
      </section>
    </>
  );
}

export default AdminSoonPage;
