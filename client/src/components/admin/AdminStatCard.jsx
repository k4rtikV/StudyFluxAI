function AdminStatCard({ icon: Icon, label, value, helper, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    cyan: "bg-cyan-100 text-cyan-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <article className="rounded-[26px] border border-slate-200/90 bg-white/88 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {value}
          </p>
        </div>
        {Icon && (
          <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone] || tones.slate}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>}
    </article>
  );
}

export default AdminStatCard;
