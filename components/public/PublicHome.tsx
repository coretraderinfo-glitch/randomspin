"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, RotateCcw, Share2, Volume2, VolumeX } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Confetti } from "@/components/public/Confetti";
import { LuckyWheel, calculateTargetRotation } from "@/components/public/LuckyWheel";
import { RangeSelector } from "@/components/public/RangeSelector";
import { RecentResults } from "@/components/public/RecentResults";
import { WinnerModal } from "@/components/public/WinnerModal";

type PublicSettings = {
  siteName: string;
  headline: string;
  subtitle: string;
  announcement: string | null;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  defaultFrom: number;
  defaultTo: number;
  maximumAllowedRange: number;
  publicDisclosureMessage: string;
};

type RecentResult = {
  winner: number;
  timestamp?: string;
};

type SpinResponse = {
  spinId: string;
  winner: number;
  timestamp: string;
  error?: never;
};

export function PublicHome({
  settings,
  initialResults
}: {
  settings: PublicSettings;
  initialResults: RecentResult[];
}) {
  const [from, setFrom] = useState(settings.defaultFrom);
  const [to, setTo] = useState(settings.defaultTo);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [modalWinner, setModalWinner] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return settings.soundEnabled;
    }

    const stored = window.localStorage.getItem("lucky-spin-sound");
    return stored ? stored === "on" : settings.soundEnabled;
  });
  const [recent, setRecent] = useState(initialResults);
  const [confetti, setConfetti] = useState(false);

  const rangeInvalid = useMemo(() => from >= to || to - from + 1 > settings.maximumAllowedRange, [
    from,
    to,
    settings.maximumAllowedRange
  ]);

  useEffect(() => {
    window.localStorage.setItem("lucky-spin-sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  function playTone(type: "tick" | "win") {
    if (!soundEnabled) {
      return;
    }

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = type === "win" ? 660 : 210;
    gain.gain.value = type === "win" ? 0.06 : 0.025;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + (type === "win" ? 0.18 : 0.04));
  }

  async function spin() {
    if (spinning) {
      return;
    }

    if (rangeInvalid) {
      setMessage(
        from >= to
          ? "FROM must be lower than TO."
          : `Please choose a range of ${settings.maximumAllowedRange} numbers or fewer.`
      );
      return;
    }

    setSpinning(true);
    setMessage(null);
    setModalWinner(null);

    try {
      const response = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const data = (await response.json()) as SpinResponse | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Spin failed.");
      }

      playTone("tick");
      const targetRotation = calculateTargetRotation(from, to, data.winner, rotation);
      setWinner(data.winner);
      setRotation(targetRotation);

      window.setTimeout(() => {
        playTone("win");
        setSpinning(false);
        setModalWinner(data.winner);
        setRecent((current) => [{ winner: data.winner, timestamp: data.timestamp }, ...current].slice(0, 10));
        if (settings.confettiEnabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setConfetti(true);
          window.setTimeout(() => setConfetti(false), 2200);
        }
      }, 5900);
    } catch (error) {
      setSpinning(false);
      setMessage(error instanceof Error ? error.message : "Spin is unavailable right now.");
    }
  }

  async function shareResult() {
    if (winner === null) {
      return;
    }

    const text = `I spun Lucky Spin and got number ${winner}!`;
    if (navigator.share) {
      await navigator.share({ title: "Lucky Spin", text, url: window.location.origin });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    setMessage("Result link copied.");
  }

  function reset() {
    setFrom(settings.defaultFrom);
    setTo(settings.defaultTo);
    setWinner(null);
    setModalWinner(null);
    setMessage(null);
    setRotation(0);
  }

  return (
    <main className="premium-shell">
      <Confetti active={confetti} />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <nav className="hidden items-center gap-5 text-sm font-bold text-[#aeb7ca] sm:flex" aria-label="Public navigation">
            <a className="hover:text-white" href="/faq">
              FAQ
            </a>
            <a className="hover:text-white" href="/about">
              About
            </a>
          </nav>
        </header>

        {settings.announcement ? (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-[rgba(246,217,143,0.22)] bg-[rgba(246,217,143,0.08)] px-4 py-3 text-center text-sm text-[#fff4d2]">
            {settings.announcement}
          </div>
        ) : null}

        <section className="grid min-w-0 flex-1 items-center gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:py-12">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full min-w-0 text-center lg:text-left"
            style={{ maxWidth: "min(36rem, calc(100vw - 2rem))" }}
          >
            <p className="mb-4 text-xs font-black uppercase tracking-[0.32em] text-[#f6d98f]">{settings.siteName}</p>
            <h1 className="mx-auto max-w-[11ch] break-words font-[var(--font-display)] text-4xl font-black uppercase leading-[0.96] text-white sm:text-6xl lg:mx-0 lg:max-w-none lg:text-7xl">
              {settings.headline}
            </h1>
            <p className="mt-5 text-lg font-medium text-[#aeb7ca] sm:text-xl">{settings.subtitle}</p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <RangeSelector label="From" value={from} onChange={setFrom} />
              <RangeSelector label="To" value={to} onChange={setTo} />
            </div>
          </motion.div>

          <motion.div initial={false} animate={{ opacity: 1, scale: 1 }} className="relative min-w-0 lg:row-span-2">
            <div className="absolute inset-8 rounded-full bg-[rgba(246,217,143,0.12)] blur-3xl" aria-hidden="true" />
            <LuckyWheel from={from} to={to} winner={winner} rotation={rotation} spinning={spinning} onSpin={spin} />
          </motion.div>

          <div className="mx-auto w-full min-w-0 text-center lg:text-left" style={{ maxWidth: "min(36rem, calc(100vw - 2rem))" }}>
            <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
              <button
                className="gold-button focus-ring rounded-lg px-7 py-4 text-sm uppercase tracking-[0.18em] transition hover:scale-[1.02] active:translate-y-px disabled:opacity-60"
                onClick={spin}
                disabled={spinning}
              >
                {spinning ? "Spinning" : "Spin"}
              </button>
              <button
                className="focus-ring grid size-12 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                onClick={reset}
                aria-label="Reset"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                className="focus-ring grid size-12 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                onClick={() => setSoundEnabled((value) => !value)}
                aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
              >
                {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <button
                className="focus-ring grid size-12 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                onClick={() => document.documentElement.requestFullscreen?.()}
                aria-label="Full screen"
              >
                <Maximize2 className="size-4" />
              </button>
              <button
                className="focus-ring grid size-12 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                onClick={shareResult}
                aria-label="Share result"
              >
                <Share2 className="size-4" />
              </button>
            </div>

            {message ? (
              <p className="mt-4 rounded-lg border border-[rgba(255,95,163,0.30)] bg-[rgba(255,95,163,0.08)] px-4 py-3 text-sm text-[#ffd7e8]">
                {message}
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-[#7f8aa3]">{settings.publicDisclosureMessage}</p>
            <div className="mt-8">
              <RecentResults results={recent} />
            </div>
          </div>
        </section>
      </div>

      <SeoSections />
      <PublicFooter />
      <WinnerModal winner={modalWinner} onClose={() => setModalWinner(null)} onShare={shareResult} onSpinAgain={spin} />
    </main>
  );
}

function SeoSections() {
  const sections = [
    ["Free Online Lucky Number Spinner", "Lucky Spin gives you a polished random number wheel for quick choices, games, giveaways, classroom picks, and friendly draws."],
    ["How Lucky Spin Works", "Choose a FROM and TO number, press SPIN, and the server selects a result from the configured eligible pool before the wheel animation begins."],
    ["Why Use Lucky Spin?", "The interface is simple for guests, responsive on phones and desktops, and designed to feel more premium than a basic random-number page."],
    ["Random Number Wheel for Games & Giveaways", "Use Lucky Spin when you need a clear visual result for lucky draws, group activities, prize picks, or everyday decisions."]
  ];

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2 lg:px-8">
      {sections.map(([title, copy]) => (
        <article key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-6">
          <h2 className="mb-3 font-[var(--font-display)] text-xl font-black text-white">{title}</h2>
          <p className="leading-7 text-[#aeb7ca]">{copy}</p>
        </article>
      ))}
    </section>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-white/10 px-4 py-8 text-sm text-[#aeb7ca] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark compact />
        <p>Free online random number spinner.</p>
        <div className="flex gap-4">
          <a href="/privacy" className="hover:text-white">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white">
            Terms
          </a>
          <a href="/faq" className="hover:text-white">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}
