const classes = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  scheduled: "border-indigo-200 bg-indigo-50 text-indigo-700",
  draft: "border-slate-200 bg-slate-100 text-slate-600",
  ended: "border-amber-200 bg-amber-50 text-amber-700",
  inactive: "border-rose-200 bg-rose-50 text-rose-700",
  verified: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

function AdminStatusBadge({ status, children }) {
  const normalized = String(status || "draft").toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
        classes[normalized] || classes.draft
      }`}
    >
      {children || normalized}
    </span>
  );
}

export default AdminStatusBadge;
