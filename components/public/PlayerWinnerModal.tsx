"use client";

import { motion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { formatPublicResultTime } from "@/lib/public-result-time";

export type PlayerWinnerResult = {
  spinId: string;
  participantId: string | null;
  displayName: string;
  reference: string | null;
  timestamp: string;
};

export function PlayerWinnerModal({
  result,
  onClose,
  onShare
}: {
  result: PlayerWinnerResult | null;
  onClose: () => void;
  onShare: () => void;
}) {
  if (!result) {
    return null;
  }

  const resultTime = formatPublicResultTime(result.timestamp);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 py-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="event-result-modal relative max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl p-5 text-center sm:p-8"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#f6d98f] to-transparent" />
        <button
          type="button"
          className="event-icon-action focus-ring absolute right-4 top-4 size-11 rounded-full text-[#aeb7ca] hover:text-white"
          onClick={onClose}
          aria-label="Close player result"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f6d98f]">Congratulations!</p>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-[#aeb7ca]">Winning Player</p>
        <div className="gold-text my-4 min-w-0 break-words font-[var(--font-display)] text-4xl font-black leading-tight sm:my-5 sm:text-7xl">
          {result.displayName}
        </div>
        {result.reference ? <p className="text-sm font-black uppercase tracking-[0.18em] text-[#dfe6f6]">Reference: {result.reference}</p> : null}
        <div className="mt-5 text-sm font-bold text-[#dfe6f6]">
          {resultTime.localTime ? <p>{resultTime.localTime}</p> : null}
          {resultTime.timezoneLabel ? <p className="mt-1 text-xs text-[#aeb7ca]">{resultTime.timezoneLabel}</p> : null}
          <p className="mt-1 text-xs text-[#8f9bb4]">{resultTime.utcTime}</p>
        </div>

        <div className="event-result-summary my-5 grid gap-2 rounded-xl p-4 text-left text-sm sm:my-6">
          {[
            ["Winning Player", result.displayName],
            ...(result.reference ? [["Reference", result.reference]] : []),
            ["Time", resultTime.localTime ?? resultTime.utcTime],
            ...(resultTime.timezoneLabel ? [["Timezone", resultTime.timezoneLabel]] : []),
            ["UTC", resultTime.utcTime]
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
              <span className="text-[#8f9bb4]">{label}</span>
              <span className="min-w-0 break-words font-black text-white">{value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className="gold-button focus-ring min-h-12 rounded-xl px-5 py-3 text-sm uppercase tracking-[0.14em]" onClick={onClose}>
            Close
          </button>
          <button
            className="event-action focus-ring flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white"
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
