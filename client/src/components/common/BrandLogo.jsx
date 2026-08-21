function BrandLogo({
  tone = "dark",
  size = "md",
  compact = false,
  className = "",
  subtitle = "",
}) {
  const inverse = tone === "inverse";
  const dimensions = {
    sm: { mark: "h-8 w-8", text: "text-lg" },
    md: { mark: "h-10 w-10", text: "text-xl" },
    lg: { mark: "h-11 w-11", text: "text-[1.35rem]" },
  }[size] || { mark: "h-10 w-10", text: "text-xl" };

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <span className="relative grid shrink-0 place-items-center">
        <span
          aria-hidden="true"
          className={`absolute inset-[14%] rounded-2xl blur-lg ${
            inverse ? "bg-cyan-300/20" : "bg-indigo-400/15"
          }`}
        />
        <img
          src="/studyfluxai-mark.png"
          alt=""
          aria-hidden="true"
          className={`relative object-contain ${dimensions.mark}`}
        />
      </span>

      {!compact && (
        <span className="min-w-0 leading-none">
          <span
            className={`block whitespace-nowrap font-black tracking-[-0.045em] ${dimensions.text}`}
          >
            <span className={inverse ? "text-white" : "text-slate-950"}>Study</span>
            <span
              className="bg-[linear-gradient(90deg,#818cf8_0%,#22d3ee_54%,#a78bfa_100%)] bg-clip-text text-transparent"
              style={
                inverse
                  ? {
                      WebkitTextStroke: "0.72px rgba(51,65,85,0.92)",
                      paintOrder: "stroke fill",
                      textShadow: "0 1px 7px rgba(15,23,42,0.18)",
                    }
                  : undefined
              }
            >
              FluxAI
            </span>
          </span>
          {subtitle ? (
            <span
              className={`mt-1 block truncate text-[9px] font-extrabold uppercase tracking-[0.16em] ${
                inverse ? "text-cyan-50/58" : "text-slate-400"
              }`}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
