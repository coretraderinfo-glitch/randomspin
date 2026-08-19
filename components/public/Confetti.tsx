"use client";

export function Confetti({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => (
        <span
          key={index}
          className="absolute top-[-10%] block size-2 rounded-sm"
          style={{
            left: `${(index * 37) % 100}%`,
            background: ["#f6d98f", "#57e7ff", "#8d5cff", "#ff5fa3"][index % 4],
            animation: `confetti-fall ${1.8 + (index % 9) * 0.08}s ease-out ${index * 0.018}s forwards`,
            transform: `rotate(${index * 19}deg)`,
            "--confetti-x": `${index % 2 === 0 ? 80 : -80}px`
          } as React.CSSProperties}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          to {
            transform: translate3d(var(--confetti-x), 115vh, 0) rotate(520deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
