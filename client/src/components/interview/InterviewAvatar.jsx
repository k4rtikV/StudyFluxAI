import { AudioLines, BrainCircuit, Mic, Sparkles } from "lucide-react";

const STATE_META = {
  ready: { label: "Ready", icon: Sparkles },
  voice_preparing: { label: "Preparing voice", icon: AudioLines },
  speaking: { label: "Speaking", icon: AudioLines },
  listening: { label: "Listening", icon: Mic },
  processing: { label: "Thinking", icon: BrainCircuit },
  paused: { label: "Paused", icon: Sparkles },
  complete: { label: "Complete", icon: Sparkles },
};

function InterviewAvatar({ state = "ready", level = 0, name = "Astra" }) {
  const meta = STATE_META[state] || STATE_META.ready;
  const StateIcon = meta.icon;
  const pulseScale = 1 + Math.min(0.08, Number(level || 0) * 0.08);

  return (
    <div className="relative mx-auto flex w-full max-w-[310px] flex-col items-center">
      <div className="pointer-events-none absolute left-1/2 top-10 h-48 w-48 -translate-x-1/2 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="pointer-events-none absolute left-[43%] top-20 h-32 w-32 rounded-full bg-cyan-300/18 blur-3xl" />
      <div
        className={`relative grid h-44 w-44 place-items-center rounded-[44px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(238,242,255,0.82),rgba(236,254,255,0.76))] shadow-[0_28px_80px_rgba(76,29,149,0.18)] transition duration-200 ${state === "speaking" || state === "voice_preparing" || state === "listening" ? "ring-4 ring-cyan-200/45" : "ring-1 ring-violet-200/70"}`}
        style={{ transform: `scale(${pulseScale})` }}
      >
        <div className="absolute inset-4 rounded-[34px] bg-[conic-gradient(from_210deg,rgba(124,58,237,0.25),rgba(34,211,238,0.26),rgba(16,185,129,0.20),rgba(124,58,237,0.25))] blur-[1px]" />
        <div className="relative grid h-32 w-32 place-items-center rounded-[34px] border border-white/80 bg-slate-950 shadow-inner">
          <div className="absolute inset-x-5 top-8 h-9 rounded-full bg-[linear-gradient(90deg,#7c3aed,#22d3ee,#10b981)] opacity-90 blur-[10px]" />
          <div className="relative flex items-center gap-4">
            <span className={`h-3.5 w-7 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)] ${state === "processing" ? "animate-pulse" : ""}`} />
            <span className={`h-3.5 w-7 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.9)] ${state === "processing" ? "animate-pulse" : ""}`} />
          </div>
          <div className="absolute bottom-7 flex h-7 items-end gap-1">
            {[0.45, 0.8, 1, 0.65, 0.9, 0.5].map((weight, index) => (
              <span
                key={index}
                className="w-1.5 rounded-full bg-gradient-to-t from-violet-400 via-cyan-300 to-emerald-300 transition-all duration-100"
                style={{ height: `${Math.max(6, 8 + (state === "speaking" ? level * 22 : state === "listening" ? level * 15 : 2) * weight)}px` }}
              />
            ))}
          </div>
          <span className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-2xl border border-white/80 bg-white text-violet-700 shadow-lg"><Sparkles size={16} /></span>
        </div>
      </div>

      <div className="relative mt-5 text-center">
        <p className="text-lg font-black tracking-tight text-slate-900">{name}</p>
        <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">StudyFluxAI interviewer</p>
        <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${state === "listening" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : state === "speaking" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : state === "processing" ? "border-violet-200 bg-violet-50 text-violet-700" : state === "voice_preparing" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-500"}`}>
          <StateIcon size={12} /> {meta.label}
        </span>
      </div>
    </div>
  );
}

export default InterviewAvatar;
