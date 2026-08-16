function FluxGemMark({
  size = 38,
  className = "",
}) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-emerald-500 via-cyan-400 to-violet-500 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-[3px] rounded-[11px] bg-white/16" />

      <svg
        viewBox="0 0 48 48"
        className="relative h-[62%] w-[62%]"
        fill="none"
      >
        <path
          d="M24 5 39 16 33.5 36H14.5L9 16 24 5Z"
          fill="white"
          fillOpacity="0.95"
        />

        <path
          d="m9 16 15 8 15-8"
          stroke="rgba(16,185,129,.55)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        <path
          d="m14.5 36 9.5-12L33.5 36"
          stroke="rgba(139,92,246,.5)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default FluxGemMark;