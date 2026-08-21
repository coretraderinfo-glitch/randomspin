"use client";

import { motion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { formatPublicResultTime } from "@/lib/public-result-time";

export type WinnerResult = {
  winner: number;
  from: number;
  to: number;
  timestamp: string;
  spinId: string;
};

type WinnerModalProps = {
  result: WinnerResult | null;
  onClose: () => void;
  onShare: () => void;
};

export function WinnerModal({ result, onClose, onShare }: WinnerModalProps) {
  if (!result) {
    return null;
  }

  const resultTime = formatPublicResultTime(result.timestamp);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass relative w-full max-w-lg overflow-hidden rounded-xl p-8 text-center"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#f6d98f] to-transparent" />
        <button
          type="button"
          className="focus-ring absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/10 text-[#aeb7ca] hover:text-white"
          onClick={onClose}
          aria-label="Close result"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f6d98f]">Congratulations!</p>
        <div className="gold-text my-5 font-[var(--font-display)] text-8xl font-black leading-none sm:text-9xl">#{result.winner}</div>
        <div className="text-sm font-bold text-[#dfe6f6]">
          {resultTime.localTime ? <p>{resultTime.localTime}</p> : null}
          {resultTime.timezoneLabel ? <p className="mt-1 text-xs text-[#aeb7ca]">{resultTime.timezoneLabel}</p> : null}
          <p className="mt-1 text-xs text-[#8f9bb4]">{resultTime.utcTime}</p>
        </div>

        <div className="my-6 grid gap-2 rounded-lg border border-white/10 bg-white/[0.045] p-4 text-left text-sm">
          {[
            ["Winning Number", result.winner],
            ["Range", `${result.from}–${result.to}`],
            ["Time", resultTime.localTime ?? resultTime.utcTime],
            ...(resultTime.timezoneLabel ? [["Timezone", resultTime.timezoneLabel]] : []),
            ["UTC", resultTime.utcTime]
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-3">
              <span className="text-[#8f9bb4]">{label}</span>
              <span className="min-w-0 break-words font-black text-white">{value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className="gold-button focus-ring rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em]" onClick={onClose}>
            Close
          </button>
          <button
            className="focus-ring flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-white/12"
            onClick={onShare}
          >
            <Share2 className="size-4" />
            Share Result
          </button>
        </div>
      </motion.div>
    </div>
  );
}
