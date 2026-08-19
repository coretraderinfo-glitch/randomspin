import { Sparkles } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Lucky Spin">
      <span className="grid size-10 place-items-center rounded-full border border-[rgba(246,217,143,0.45)] bg-[rgba(246,217,143,0.10)] shadow-[0_0_28px_rgba(246,217,143,0.16)]">
        <Sparkles className="size-5 text-[#f6d98f]" aria-hidden="true" />
      </span>
      <span
        className={`font-[var(--font-display)] font-black uppercase tracking-[0.16em] ${compact ? "text-sm" : "text-base"}`}
      >
        Lucky <span className="gold-text">Spin</span>
      </span>
    </div>
  );
}
