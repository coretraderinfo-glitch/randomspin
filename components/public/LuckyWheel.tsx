"use client";

import { motion } from "framer-motion";
import { calculateTargetRotation, getWheelVisualPlan } from "@/lib/wheel-visual";

type LuckyWheelProps = {
  from: number;
  to: number;
  winner: number | null;
  rotation: number;
  spinning: boolean;
  onSpin: () => void;
};

const colors = ["#f6d98f", "#2c1f59", "#101a35", "#7d315f", "#0d6170", "#171c2f"];

function cleanNumber(value: number) {
  return Number(value.toFixed(4));
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cleanNumber(cx + r * Math.cos(angleInRadians)),
    y: cleanNumber(cy + r * Math.sin(angleInRadians))
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "Z"].join(" ");
}

export { calculateTargetRotation };

export function LuckyWheel({ from, to, winner, rotation, spinning, onSpin }: LuckyWheelProps) {
  const plan = getWheelVisualPlan(from, to, winner);
  const count = plan.rangeSize;
  const visualCount = plan.renderedSegmentCount;
  const segmentAngle = 360 / visualCount;
  const showEvery = plan.mode === "numbered" ? (count <= 36 ? 1 : count <= 80 ? 2 : 5) : 0;

  const segments = Array.from({ length: visualCount }, (_, index) => {
    const start = index * segmentAngle;
    const end = start + segmentAngle;
    const value = from + index;
    const labelAngle = cleanNumber(start + segmentAngle / 2);
    const label = showEvery && index % showEvery === 0 ? String(value) : "";
    const labelPosition = polarToCartesian(250, 250, count <= 24 ? 158 : 170, labelAngle);

    return {
      path: describeArc(250, 250, 218, start, end),
      color: colors[index % colors.length],
      label,
      labelAngle,
      labelPosition
    };
  });

  return (
    <div className="relative mx-auto aspect-square w-full min-w-0" style={{ maxWidth: "clamp(300px, 78vw, 560px)" }}>
      <div className="pointer-events-none absolute left-1/2 top-[-2px] z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[17px] border-t-[34px] border-x-transparent border-t-[#f6d98f] drop-shadow-[0_7px_18px_rgba(246,217,143,0.5)]" />
      </div>
      {plan.mode === "large-range" ? (
        <div className="pointer-events-none absolute left-1/2 top-9 z-30 -translate-x-1/2 rounded-full border border-[rgba(246,217,143,0.5)] bg-[#080b18]/85 px-4 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Exact Result</p>
          <p className="gold-text font-[var(--font-display)] text-xl font-black leading-none">
            {spinning || winner === null ? "..." : plan.visualTargetResult}
          </p>
        </div>
      ) : null}

      <motion.svg
        viewBox="0 0 500 500"
        className="h-full w-full overflow-visible drop-shadow-[0_32px_90px_rgba(0,0,0,0.62)]"
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 5.8 : 0.3, ease: [0.12, 0.78, 0.14, 1] }}
        aria-label="Lucky Spin wheel"
      >
        <defs>
          <radialGradient id="wheel-glow" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#f6d98f" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
          </radialGradient>
          <linearGradient id="metal-ring" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#7b541d" />
            <stop offset="30%" stopColor="#fff0b2" />
            <stop offset="58%" stopColor="#bb842e" />
            <stop offset="100%" stopColor="#fff7d6" />
          </linearGradient>
        </defs>
        <circle cx="250" cy="250" r="238" fill="url(#metal-ring)" />
        <circle cx="250" cy="250" r="226" fill="#05060d" />
        {segments.map((segment, index) => (
          <g key={index}>
            <path d={segment.path} fill={segment.color} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            {segment.label ? (
              <text
                x={segment.labelPosition.x}
                y={segment.labelPosition.y}
                fill="#fffaf0"
                fontSize={count <= 36 ? 20 : 14}
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${segment.labelAngle} ${segment.labelPosition.x} ${segment.labelPosition.y})`}
              >
                {segment.label}
              </text>
            ) : null}
          </g>
        ))}
        <circle cx="250" cy="250" r="218" fill="url(#wheel-glow)" />
        <circle cx="250" cy="250" r="72" fill="url(#metal-ring)" />
        <circle cx="250" cy="250" r="59" fill="#080b18" stroke="rgba(255,255,255,0.18)" />
        <text x="250" y="242" textAnchor="middle" fill="#f6d98f" fontSize="21" fontWeight="900" letterSpacing="3">
          SPIN
        </text>
        <text x="250" y="266" textAnchor="middle" fill="#aeb7ca" fontSize="10" fontWeight="700" letterSpacing="2">
          {plan.mode === "large-range" ? `${from}-${to}` : "LUCKY"}
        </text>
        <path d="M145 95 C230 45 342 63 400 140" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="14" strokeLinecap="round" />
      </motion.svg>

      <button
        type="button"
        className="gold-button focus-ring absolute left-1/2 top-1/2 z-30 grid size-[108px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-lg transition hover:scale-[1.03] active:scale-95 disabled:opacity-70"
        onClick={onSpin}
        disabled={spinning}
        aria-label="Spin the wheel"
      >
        {spinning ? "..." : winner === null ? "SPIN" : "AGAIN"}
      </button>
    </div>
  );
}
