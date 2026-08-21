import { RefreshCw } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="RandomSpin">
      <span className="grid size-10 place-items-center rounded-full border border-[rgba(37,99,235,0.26)] bg-white shadow-[0_12px_28px_rgba(37,99,235,0.16)]">
        <RefreshCw className="size-5 text-[#2563eb]" aria-hidden="true" />
      </span>
      <span
        className={`font-[var(--font-display)] font-black tracking-[0.02em] text-[#13213a] ${compact ? "text-sm" : "text-base"}`}
      >
        Random<span className="gold-text">Spin</span>
      </span>
    </div>
  );
}
