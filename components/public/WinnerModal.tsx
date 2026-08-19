"use client";

import { motion } from "framer-motion";
import { Share2, X } from "lucide-react";

type WinnerModalProps = {
  winner: number | null;
  onClose: () => void;
  onShare: () => void;
  onSpinAgain: () => void;
};

export function WinnerModal({ winner, onClose, onShare, onSpinAgain }: WinnerModalProps) {
  if (winner === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass relative w-full max-w-md rounded-xl p-8 text-center"
      >
        <button
          type="button"
          className="focus-ring absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/10 text-[#aeb7ca] hover:text-white"
          onClick={onClose}
          aria-label="Close result"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#f6d98f]">Your Lucky Number</p>
        <div className="gold-text my-5 font-[var(--font-display)] text-8xl font-black leading-none">{winner}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className="gold-button focus-ring rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em]" onClick={onSpinAgain}>
            Spin Again
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
