import { useId } from "react";

function LevelKite({
  level = 1,
  size = 48,
  className = "",
  showTail = true,
}) {
  const rawId = useId();
  const gradientId = `level-kite-${rawId.replace(/:/g, "")}`;
  const glowId = `level-kite-glow-${rawId.replace(/:/g, "")}`;
  const numericLevel = Math.max(Number(level) || 1, 1);
  const height = showTail ? Math.round(size * 1.22) : size;

  return (
    <svg
      width={size}
      height={height}
      viewBox={showTail ? "0 0 72 88" : "0 0 72 72"}
      className={className}
      role="img"
      aria-label={`Level ${numericLevel}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="0.42" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="175%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#6d28d9" floodOpacity="0.22" />
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        <path
          d="M36 3 66 31 36 64 6 31 36 3Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M36 9 59 31 36 57 13 31 36 9Z"
          fill="rgba(255,255,255,0.12)"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.25"
        />
        <path
          d="M36 9 36 57M13 31h46"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      </g>

      <text
        x="36"
        y="38"
        textAnchor="middle"
        fill="white"
        fontSize={numericLevel >= 10 ? "19" : "22"}
        fontWeight="900"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        {numericLevel}
      </text>

      {showTail ? (
        <g fill="none" strokeLinecap="round">
          <path
            d="M36 63c10 7-7 9 2 16 4 3 4 5 2 7"
            stroke="#7c3aed"
            strokeWidth="2.25"
            opacity="0.72"
          />
          <path d="m32 70 5-3 4 4-5 3-4-4Z" fill="#22d3ee" stroke="white" strokeWidth="0.8" />
          <path d="m34 79 5-3 4 4-5 3-4-4Z" fill="#10b981" stroke="white" strokeWidth="0.8" />
        </g>
      ) : null}
    </svg>
  );
}

export default LevelKite;
