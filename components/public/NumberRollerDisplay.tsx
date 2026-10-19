"use client";

import type { CSSProperties } from "react";

type NumberRollerDisplayProps = {
  from: number;
  to: number;
  currentNumber: number;
  phase: "READY" | "ROLLING" | "WINNING";
  tempo: "READY" | "FAST" | "SLOW" | "WINNING";
  spinning: boolean;
  shuffling?: boolean;
};

export function NumberRollerDisplay({ from, to, currentNumber, phase, tempo, spinning, shuffling = false }: NumberRollerDisplayProps) {
  const status = phase === "WINNING" ? "WINNING NUMBER" : shuffling ? "MIXING NUMBERS" : spinning ? "RANDOMIZING" : "READY";
  const displayValue = shuffling || phase !== "READY" ? currentNumber.toString() : "?";
  const fourDigitValue = displayValue.replace("-", "").length >= 4;
  const valueSizeClassName = fourDigitValue
    ? "number-roller-value-four-digit text-[4.25rem] sm:text-[5.75rem] lg:text-[7rem]"
    : "text-7xl sm:text-8xl lg:text-9xl";
  const orbClassName = [
    "number-roller-orb relative mx-auto grid aspect-square w-full min-w-0 place-items-center overflow-hidden rounded-full",
    phase === "ROLLING" ? "is-rolling" : "",
    shuffling ? "is-shuffling" : "",
    tempo === "FAST" ? "is-fast" : "",
    tempo === "SLOW" ? "is-slow" : "",
    phase === "WINNING" ? "is-winning" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const particleColors = ["#06b6d4", "#2563eb", "#7c3aed", "#14b8a6", "#38bdf8", "#8b5cf6"];

  return (
    <div
      className={orbClassName}
      style={{ maxWidth: "min(clamp(260px, 62vw, 500px), calc(100svh - 5.75rem))" }}
      data-testid="number-roller-display"
      data-roller-shuffling={shuffling ? "true" : "false"}
    >
      <div className="number-roller-ring" aria-hidden="true" />
      <div className="number-roller-glass" aria-hidden="true" />
      <div className="number-roller-inner-ring one" aria-hidden="true" />
      <div className="number-roller-inner-ring two" aria-hidden="true" />
      <div className="number-roller-burst" aria-hidden="true" />
      <div className="number-roller-orbits" aria-hidden="true">
        {particleColors.map((color, index) => (
          <span
            key={color}
            className="number-roller-particle"
            style={{
              "--particle-color": color,
              "--particle-angle": `${index * 60}deg`,
              "--particle-delay": `${index * -0.42}s`
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="relative z-10 w-full px-8 text-center">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.28em] text-[#2563eb]">Number Roller</p>
        <div
          className="mx-auto mt-4 grid min-h-[6.5rem] place-items-center overflow-hidden sm:mt-5 sm:min-h-[9rem]"
            aria-hidden={phase !== "WINNING" && !shuffling}
        >
          <span
            key={displayValue}
            className={`number-roller-value gold-text block font-[var(--font-display)] font-black leading-none ${valueSizeClassName} ${
              spinning || shuffling ? "is-changing" : ""
            }`}
            data-testid="number-roller-value"
          >
            {displayValue}
          </span>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-[#334155] sm:mt-5">
          {status}
          {phase === "ROLLING" || shuffling ? (
            <span className="number-roller-dots" aria-hidden="true">
              {" "}
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </p>
        {phase === "READY" ? <p className="mt-3 text-sm font-semibold text-[#5f6f89]">Press SPIN to draw a number</p> : null}
        <p className="mt-3 text-sm font-medium text-[#5f6f89]">
          Range {from}-{to}
        </p>
        <p className="sr-only" aria-live="polite">
          {phase === "WINNING" ? `Winning number ${currentNumber}` : ""}
        </p>
      </div>
    </div>
  );
}
