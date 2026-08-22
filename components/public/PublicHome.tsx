"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CircleDot, Maximize2, RotateCcw, Share2, Volume2, VolumeX } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Confetti } from "@/components/public/Confetti";
import { LuckyWheel } from "@/components/public/LuckyWheel";
import { NumberRollerDisplay } from "@/components/public/NumberRollerDisplay";
import { PublicGameNav } from "@/components/public/PublicGameNav";
import { RangeSelector } from "@/components/public/RangeSelector";
import { RecentResults } from "@/components/public/RecentResults";
import { WinnerModal, type WinnerResult } from "@/components/public/WinnerModal";
import {
  PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY,
  PRIVATE_DRAW_WHEEL_DISPLAY,
  normalizePrivateDrawDisplayStyle,
  type PrivateDrawDisplayStyle
} from "@/lib/private-draw-display";
import {
  createDecelerationPlan,
  getDecelerationKinematics,
  getMinimumDecelerationStartMs,
  nextNeutralKinematics,
  type DecelerationPlan,
  type SpinKinematics
} from "@/lib/spin-physics";
import { getWheelVisualPlan } from "@/lib/wheel-visual";

export type PublicSettings = {
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

export type RecentResult = {
  winner: number;
  timestamp?: string;
};

export type PublicDrawMode =
  | {
      kind: "public";
      spinEndpoint?: string;
      label?: null;
    }
  | {
      kind: "private";
      publicCode: string;
      spinEndpoint: string;
      label?: string;
      displayStyle?: PrivateDrawDisplayStyle;
    };

type SpinResponse = {
  spinId: string;
  winner: number;
  timestamp: string;
  from?: number;
  to?: number;
  mode?: "RANDOM" | "OPERATOR";
  nextLabel?: string;
  error?: never;
};

const NUMBER_ROLLER_FAST_INTERVAL_MS = 52;
const NUMBER_ROLLER_MIN_ACTIVE_MS = 1120;
const NUMBER_ROLLER_REDUCED_MOTION_MIN_ACTIVE_MS = 620;
const NUMBER_ROLLER_FINAL_DELAYS_MS = [100, 140, 190, 260];
const NUMBER_ROLLER_REDUCED_MOTION_FINAL_DELAYS_MS = [180, 260, 340];

export function PublicHome({
  settings,
  initialResults,
  drawMode = { kind: "public", spinEndpoint: "/api/spin", label: null }
}: {
  settings: PublicSettings;
  initialResults: RecentResult[];
  drawMode?: PublicDrawMode;
}) {
  const [from, setFrom] = useState(settings.defaultFrom);
  const [to, setTo] = useState(settings.defaultTo);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [highlightedWinner, setHighlightedWinner] = useState<number | null>(null);
  const [result, setResult] = useState<WinnerResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [hasCompletedSpin, setHasCompletedSpin] = useState(false);
  const [rollerNumber, setRollerNumber] = useState(settings.defaultFrom);
  const [rollerPhase, setRollerPhase] = useState<"READY" | "ROLLING" | "WINNING">("READY");
  const [rollerTempo, setRollerTempo] = useState<"READY" | "FAST" | "SLOW" | "WINNING">("READY");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "danger">("neutral");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return settings.soundEnabled;
    }

    const stored = window.localStorage.getItem("lucky-spin-sound");
    return stored ? stored === "on" : settings.soundEnabled;
  });
  const [recent, setRecent] = useState(initialResults);
  const [confetti, setConfetti] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const decelerationWaitTimerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const pointerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(rotation);
  const spinActiveRef = useRef(false);
  const spinStartedAtRef = useRef(0);
  const neutralFrameAtRef = useRef(0);
  const kinematicsRef = useRef<SpinKinematics>({ angle: rotation, velocity: 0 });
  const rollerTimerRef = useRef<number | null>(null);
  const rollerSequenceRef = useRef<number[]>([]);
  const rollerSequenceIndexRef = useRef(0);
  const rollerLastPlaceholderRef = useRef<number | null>(null);

  const rangeInvalid = useMemo(() => from >= to || to - from + 1 > settings.maximumAllowedRange, [
    from,
    to,
    settings.maximumAllowedRange
  ]);
  const spinButtonLabel = hasCompletedSpin ? "SPIN AGAIN" : "SPIN";
  const spinEndpoint = drawMode.spinEndpoint ?? "/api/spin";
  const initialDrawModeLabel = drawMode.kind === "private" ? drawMode.label ?? "PRIVATE EVENT DRAW" : null;
  const [liveDrawModeLabel, setLiveDrawModeLabel] = useState(initialDrawModeLabel);
  const drawModeLabel = drawMode.kind === "private" ? liveDrawModeLabel : null;
  const configuredViewMode =
    drawMode.kind === "private" ? normalizePrivateDrawDisplayStyle(drawMode.displayStyle) : PRIVATE_DRAW_WHEEL_DISPLAY;
  const initialViewMode =
    configuredViewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY ? PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY : PRIVATE_DRAW_WHEEL_DISPLAY;
  const [viewMode, setViewMode] = useState<PrivateDrawDisplayStyle>(initialViewMode);
  const showNumberRoller = viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY;

  useEffect(() => {
    window.localStorage.setItem("lucky-spin-sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!spinActiveRef.current) {
      setRollerNumber(from);
      rollerSequenceRef.current = [];
      rollerSequenceIndexRef.current = 0;
      rollerLastPlaceholderRef.current = null;
      setRollerPhase("READY");
      setRollerTempo("READY");
    }
  }, [from, to]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }

      if (decelerationWaitTimerRef.current !== null) {
        window.clearTimeout(decelerationWaitTimerRef.current);
      }

      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }

      if (confettiTimerRef.current !== null) {
        window.clearTimeout(confettiTimerRef.current);
      }

      if (rollerTimerRef.current !== null) {
        window.clearTimeout(rollerTimerRef.current);
      }

      void audioRef.current?.close();
    };
  }, []);

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function applyWheelRotation(nextRotation: number) {
    rotationRef.current = nextRotation;
    kinematicsRef.current.angle = nextRotation;

    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${nextRotation}deg)`;
    }
  }

  function triggerPointerFlex() {
    pointerRef.current?.animate?.([{ transform: "rotate(0deg)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(2deg)" }, { transform: "rotate(0deg)" }], {
      duration: 170,
      easing: "ease-out"
    });
  }

  function getAudioContext() {
    if (!soundEnabled) {
      return null;
    }

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    audioRef.current ??= new AudioContextClass();

    if (audioRef.current.state === "suspended") {
      void audioRef.current.resume();
    }

    return audioRef.current;
  }

  function playRouletteTick(final = false) {
    const audio = getAudioContext();
    if (!audio) {
      return;
    }

    const now = audio.currentTime;
    const body = audio.createOscillator();
    const click = audio.createOscillator();
    const bodyGain = audio.createGain();
    const clickGain = audio.createGain();

    body.type = "sine";
    body.frequency.setValueAtTime(final ? 118 : 96, now);
    bodyGain.gain.setValueAtTime(final ? 0.034 : 0.022, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 0.095 : 0.055));

    click.type = "square";
    click.frequency.setValueAtTime(final ? 360 : 290, now);
    clickGain.gain.setValueAtTime(final ? 0.05 : 0.032, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 0.045 : 0.03));

    body.connect(bodyGain);
    click.connect(clickGain);
    bodyGain.connect(audio.destination);
    clickGain.connect(audio.destination);

    body.start(now);
    click.start(now);
    body.stop(now + 0.1);
    click.stop(now + 0.05);
  }

  function playWinnerSound() {
    const audio = getAudioContext();
    if (!audio) {
      return;
    }

    const notes = [
      { frequency: 523.25, at: 0, duration: 0.22, gain: 0.034 },
      { frequency: 659.25, at: 0.2, duration: 0.24, gain: 0.04 },
      { frequency: 783.99, at: 0.44, duration: 0.62, gain: 0.052 }
    ];

    for (const note of notes) {
      const start = audio.currentTime + note.at;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.04);
    }
  }

  function clearSpinTimers() {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (decelerationWaitTimerRef.current !== null) {
      window.clearTimeout(decelerationWaitTimerRef.current);
      decelerationWaitTimerRef.current = null;
    }

    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }

    if (confettiTimerRef.current !== null) {
      window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }

    if (rollerTimerRef.current !== null) {
      window.clearTimeout(rollerTimerRef.current);
      rollerTimerRef.current = null;
    }
  }

  function playSegmentTick(final: boolean) {
    playRouletteTick(final);
    triggerPointerFlex();
  }

  function startNeutralSpin(renderedSegmentCount: number) {
    const segmentAngle = 360 / renderedSegmentCount;
    const minimumTickGap = renderedSegmentCount > 80 ? 38 : 28;
    let previousBoundary = Math.floor(rotationRef.current / segmentAngle);
    let lastTickAt = 0;

    const frame = (timestamp: number) => {
      if (neutralFrameAtRef.current === 0) {
        neutralFrameAtRef.current = timestamp;
      }

      const elapsed = timestamp - spinStartedAtRef.current;
      const deltaMs = Math.min(timestamp - neutralFrameAtRef.current, 50);
      neutralFrameAtRef.current = timestamp;
      const next = nextNeutralKinematics(kinematicsRef.current, deltaMs, elapsed, prefersReducedMotion());
      const nextRotation = next.angle;
      const boundary = Math.floor(nextRotation / segmentAngle);

      if (!prefersReducedMotion() && boundary !== previousBoundary && timestamp - lastTickAt >= minimumTickGap) {
        playSegmentTick(false);
        lastTickAt = timestamp;
      }

      previousBoundary = boundary;
      kinematicsRef.current = next;
      applyWheelRotation(nextRotation);
      animationRef.current = window.requestAnimationFrame(frame);
    };

    animationRef.current = window.requestAnimationFrame(frame);
  }

  function buildRollerPlaceholderSequence() {
    const rangeSize = Math.max(to - from + 1, 1);
    const values = Array.from({ length: rangeSize }, (_, index) => from + index);

    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }

    if (values.length > 1 && values[0] === rollerLastPlaceholderRef.current) {
      [values[0], values[1]] = [values[1], values[0]];
    }

    rollerSequenceRef.current = values;
    rollerSequenceIndexRef.current = 0;
  }

  function takeRollerSequenceCandidate() {
    if (rollerSequenceIndexRef.current >= rollerSequenceRef.current.length) {
      buildRollerPlaceholderSequence();
    }

    const next = rollerSequenceRef.current[rollerSequenceIndexRef.current] ?? from;
    rollerSequenceIndexRef.current += 1;
    return next;
  }

  function getNextRollerPlaceholder(avoidValue?: number) {
    let next = takeRollerSequenceCandidate();

    if (to > from && (next === rollerLastPlaceholderRef.current || next === avoidValue)) {
      const maxAttempts = Math.max(to - from + 1, 2) + 1;
      let fallback = next;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = takeRollerSequenceCandidate();
        if (candidate !== rollerLastPlaceholderRef.current && candidate !== avoidValue) {
          next = candidate;
          break;
        }

        if (candidate !== avoidValue) {
          fallback = candidate;
        }
      }

      if (next === rollerLastPlaceholderRef.current || next === avoidValue) {
        next = fallback;
      }
    }

    rollerLastPlaceholderRef.current = next;
    return next;
  }

  function playRollerTick(final = false) {
    playRouletteTick(final);
  }

  function startNeutralRoller() {
    setRollerPhase("ROLLING");
    setRollerTempo("FAST");
    rollerSequenceRef.current = [];
    rollerSequenceIndexRef.current = 0;
    rollerLastPlaceholderRef.current = null;
    setRollerNumber(getNextRollerPlaceholder());

    const tick = () => {
      setRollerNumber(getNextRollerPlaceholder());
      if (!prefersReducedMotion()) {
        playRollerTick(false);
      }
      rollerTimerRef.current = window.setTimeout(tick, prefersReducedMotion() ? 180 : NUMBER_ROLLER_FAST_INTERVAL_MS);
    };

    rollerTimerRef.current = window.setTimeout(tick, prefersReducedMotion() ? 180 : NUMBER_ROLLER_FAST_INTERVAL_MS);
  }

  function finishNumberRoller(winningNumber: number, onComplete: () => void) {
    const beginFinalSlowdown = () => {
      clearSpinTimers();
      setRollerPhase("ROLLING");
      setRollerTempo("SLOW");

      const delays = prefersReducedMotion() ? NUMBER_ROLLER_REDUCED_MOTION_FINAL_DELAYS_MS : NUMBER_ROLLER_FINAL_DELAYS_MS;
      let index = 0;

      const tick = () => {
        if (index >= delays.length) {
          setRollerNumber(winningNumber);
          setRollerPhase("WINNING");
          setRollerTempo("WINNING");
          playRollerTick(true);
          onComplete();
          return;
        }

        setRollerNumber(getNextRollerPlaceholder(winningNumber));
        if (!prefersReducedMotion()) {
          playRollerTick(false);
        }
        index += 1;
        rollerTimerRef.current = window.setTimeout(tick, delays[index] ?? delays[delays.length - 1]);
      };

      rollerTimerRef.current = window.setTimeout(tick, delays[0]);
    };

    const waitForMinimumRolling = () => {
      const minimumActiveMs = prefersReducedMotion() ? NUMBER_ROLLER_REDUCED_MOTION_MIN_ACTIVE_MS : NUMBER_ROLLER_MIN_ACTIVE_MS;
      const elapsed = performance.now() - spinStartedAtRef.current;

      if (elapsed < minimumActiveMs) {
        decelerationWaitTimerRef.current = window.setTimeout(waitForMinimumRolling, Math.min(minimumActiveMs - elapsed, 90));
        return;
      }

      decelerationWaitTimerRef.current = null;
      beginFinalSlowdown();
    };

    waitForMinimumRolling();
  }

  function animateDeceleration({
    plan,
    renderedSegmentCount,
    onComplete,
    finalTick = false
  }: {
    plan: DecelerationPlan;
    renderedSegmentCount: number;
    onComplete: () => void;
    finalTick?: boolean;
  }) {
    const startRotation = rotationRef.current;
    const segmentAngle = 360 / renderedSegmentCount;
    const minTickGap = renderedSegmentCount > 80 ? 42 : 30;
    let startedAt: number | null = null;
    let previousBoundary = Math.floor(startRotation / segmentAngle);
    let lastTickAt = 0;
    let previousVelocity = plan.initialVelocity;

    const frame = (timestamp: number) => {
      startedAt ??= timestamp;
      const elapsed = timestamp - startedAt;
      const next = getDecelerationKinematics(startRotation, plan, elapsed);
      const nextRotation = next.angle;
      const boundary = Math.floor(nextRotation / segmentAngle);

      if (!prefersReducedMotion() && boundary !== previousBoundary && timestamp - lastTickAt >= minTickGap) {
        playSegmentTick(false);
        lastTickAt = timestamp;
      }

      previousBoundary = boundary;
      kinematicsRef.current = next;
      applyWheelRotation(nextRotation);

      if (process.env.NODE_ENV === "development" && next.velocity > previousVelocity + 0.5) {
        console.warn("RandomSpin velocity increased during deceleration.", {
          previousVelocity,
          nextVelocity: next.velocity
        });
      }
      previousVelocity = next.velocity;

      if (elapsed < plan.durationMs) {
        animationRef.current = window.requestAnimationFrame(frame);
        return;
      }

      animationRef.current = null;
      if (finalTick) {
        playSegmentTick(true);
      }
      setRotation(plan.targetRotation);
      onComplete();
    };

    animationRef.current = window.requestAnimationFrame(frame);
  }

  function finishWithServerWinner({
    winner,
    renderedSegmentCount,
    onComplete
  }: {
    winner: number;
    renderedSegmentCount: number;
    onComplete: () => void;
  }) {
    const waitForDeceleration = () => {
      const elapsed = performance.now() - spinStartedAtRef.current;
      const decelerationStartMs = getMinimumDecelerationStartMs(elapsed, prefersReducedMotion());

      if (elapsed < decelerationStartMs) {
        decelerationWaitTimerRef.current = window.setTimeout(waitForDeceleration, Math.min(decelerationStartMs - elapsed, 80));
        return;
      }

      decelerationWaitTimerRef.current = null;
      clearSpinTimers();
      const plan = createDecelerationPlan({
        from,
        to,
        winner,
        currentAngle: kinematicsRef.current.angle,
        currentVelocity: kinematicsRef.current.velocity,
        reducedMotion: prefersReducedMotion()
      });
      animateDeceleration({
        plan,
        renderedSegmentCount,
        finalTick: true,
        onComplete
      });
    };

    waitForDeceleration();
  }

  async function spin() {
    if (spinActiveRef.current) {
      return;
    }

    if (rangeInvalid) {
      setMessageTone("danger");
      setMessage(
        from >= to
          ? "FROM must be lower than TO."
          : `Please choose a range of ${settings.maximumAllowedRange} numbers or fewer.`
      );
      return;
    }

    spinActiveRef.current = true;
    setSpinning(true);
    setMessageTone("neutral");
    setMessage(null);
    setResult(null);
    setHighlightedWinner(null);
    setConfetti(false);
    clearSpinTimers();
    void getAudioContext();
    spinStartedAtRef.current = performance.now();
    neutralFrameAtRef.current = 0;
    kinematicsRef.current = { angle: rotationRef.current, velocity: 0 };
    if (showNumberRoller) {
      startNeutralRoller();
    } else {
      startNeutralSpin(getWheelVisualPlan(from, to, null).renderedSegmentCount);
    }

    try {
      const response = await fetch(spinEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const data = (await response.json()) as SpinResponse | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Spin failed.");
      }

      const resultFrom = data.from ?? from;
      const resultTo = data.to ?? to;
      const effectiveFrom = drawMode.kind === "private" ? resultFrom : from;
      const effectiveTo = drawMode.kind === "private" ? resultTo : to;
      const spinResult = { winner: data.winner, spinId: data.spinId, timestamp: data.timestamp, from: resultFrom, to: resultTo };
      setWinner(data.winner);
      const completedRoundLabel = data.mode === "OPERATOR" ? "OPERATOR DRAW" : data.mode === "RANDOM" ? "RANDOM DRAW" : null;
      if (drawMode.kind === "private") {
        setFrom(resultFrom);
        setTo(resultTo);
        if (completedRoundLabel) {
          setLiveDrawModeLabel(completedRoundLabel);
        }
      }

      const completeSpin = () => {
        setSpinning(false);
        setHasCompletedSpin(true);
        spinActiveRef.current = false;
        celebrationTimerRef.current = window.setTimeout(() => {
          setHighlightedWinner(data.winner);
          playWinnerSound();
          setResult(spinResult);
          setRecent((current) => [{ winner: data.winner, timestamp: data.timestamp }, ...current].slice(0, 10));
          if (drawMode.kind === "private" && data.nextLabel) {
            setLiveDrawModeLabel(data.nextLabel);
          }

          if (settings.confettiEnabled && !prefersReducedMotion()) {
            setConfetti(true);
            confettiTimerRef.current = window.setTimeout(() => setConfetti(false), 2200);
          }
        }, showNumberRoller ? 1200 : 380);
      };

      if (showNumberRoller) {
        finishNumberRoller(data.winner, completeSpin);
      } else {
        const visualPlan = getWheelVisualPlan(effectiveFrom, effectiveTo, data.winner);
        finishWithServerWinner({
          winner: data.winner,
          renderedSegmentCount: visualPlan.renderedSegmentCount,
          onComplete: completeSpin
        });
      }
    } catch (error) {
      clearSpinTimers();
      if (showNumberRoller) {
        spinActiveRef.current = false;
        setSpinning(false);
        setRollerPhase("READY");
        setRollerTempo("READY");
        setMessageTone("danger");
        setMessage("Unable to complete this spin. Please try again.");
        return;
      }

      const stopRotation = rotationRef.current + (prefersReducedMotion() ? 45 : 180);
      const distance = stopRotation - rotationRef.current;
      const stopVelocity = Math.max(kinematicsRef.current.velocity, prefersReducedMotion() ? 120 : 420);
      animateDeceleration({
        plan: {
          targetRotation: stopRotation,
          durationMs: (2 * distance * 1000) / stopVelocity,
          initialVelocity: stopVelocity
        },
        renderedSegmentCount: getWheelVisualPlan(from, to, null).renderedSegmentCount,
        onComplete: () => {
          setSpinning(false);
          spinActiveRef.current = false;
          setMessageTone("danger");
          setMessage(error instanceof Error ? "Unable to complete this spin. Please try again." : "Unable to complete this spin. Please try again.");
        }
      });
    }
  }

  function closeResult() {
    setResult(null);
    setHighlightedWinner(null);
  }

  async function shareResult() {
    if (winner === null) {
      return;
    }

    const text = `I used RandomSpin and got number ${winner}!`;
    if (navigator.share) {
      await navigator.share({ title: "RandomSpin", text, url: window.location.origin });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    setMessageTone("neutral");
    setMessage("Result link copied.");
  }

  function reset() {
    clearSpinTimers();
    setFrom(settings.defaultFrom);
    setTo(settings.defaultTo);
    setWinner(null);
    setHighlightedWinner(null);
    setResult(null);
    setMessageTone("neutral");
    setMessage(null);
    setConfetti(false);
    setSpinning(false);
    setHasCompletedSpin(false);
    setRollerNumber(settings.defaultFrom);
    setRollerPhase("READY");
    setRollerTempo("READY");
    rollerSequenceRef.current = [];
    rollerSequenceIndexRef.current = 0;
    rollerLastPlaceholderRef.current = null;
    spinActiveRef.current = false;
    rotationRef.current = 0;
    setRotation(0);
    applyWheelRotation(0);
  }

  function switchView(nextView: PrivateDrawDisplayStyle) {
    if (spinActiveRef.current || spinning) {
      return;
    }

    setViewMode(nextView);
  }

  return (
    <main className="premium-shell">
      <Confetti active={confetti} />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-3">
            {drawMode.kind === "public" ? <PublicGameNav active="spin" /> : null}
            <nav className="hidden items-center gap-5 text-sm font-bold text-[#aeb7ca] md:flex" aria-label="Public navigation">
              <a className="hover:text-white" href="/faq">
                FAQ
              </a>
              <a className="hover:text-white" href="/about">
                About
              </a>
            </nav>
          </div>
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
            <div className="mb-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f6d98f]">{settings.siteName}</p>
              {drawModeLabel ? (
                <span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#dfe6f6]">
                  {drawModeLabel}
                </span>
              ) : null}
            </div>
            <h1 className="mx-auto max-w-[11ch] break-words font-[var(--font-display)] text-4xl font-black uppercase leading-[0.96] text-white sm:text-6xl lg:mx-0 lg:max-w-none lg:text-7xl">
              {settings.headline}
            </h1>
            <p className="mt-5 text-lg font-medium text-[#aeb7ca] sm:text-xl">{settings.subtitle}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#7f8aa3]">
              Use RandomSpin to spin numbers, pick random players, and run simple live draws in a clean web-based experience.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <RangeSelector label="From" value={from} onChange={setFrom} />
              <RangeSelector label="To" value={to} onChange={setTo} />
            </div>
          </motion.div>

          <motion.div initial={false} animate={{ opacity: 1, scale: 1 }} className="relative min-w-0 lg:row-span-2">
            <div className="relative z-20 mb-3 flex justify-center lg:justify-end">
              <div className="view-mode-control inline-grid grid-cols-2 overflow-hidden rounded-full p-1" aria-label="View mode">
                <button
                  className={`focus-ring flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-4 ${
                    viewMode === PRIVATE_DRAW_WHEEL_DISPLAY ? "view-mode-button-active" : "view-mode-button-idle"
                  }`}
                  type="button"
                  disabled={spinning}
                  aria-pressed={viewMode === PRIVATE_DRAW_WHEEL_DISPLAY}
                  onClick={() => switchView(PRIVATE_DRAW_WHEEL_DISPLAY)}
                >
                  <CircleDot className="size-4 text-[#2563eb]" />
                  Wheel
                </button>
                <button
                  className={`focus-ring flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-4 ${
                    viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY ? "view-mode-button-active" : "view-mode-button-idle"
                  }`}
                  type="button"
                  disabled={spinning}
                  aria-pressed={viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY}
                  onClick={() => switchView(PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY)}
                >
                  <span className="text-xs font-black text-[#2563eb]" aria-hidden="true">
                    123
                  </span>
                  Number
                </button>
              </div>
            </div>
            <div className="absolute inset-10 rounded-full bg-[rgba(37,99,235,0.12)] blur-3xl" aria-hidden="true" />
            {showNumberRoller ? (
              <NumberRollerDisplay from={from} to={to} currentNumber={rollerNumber} phase={rollerPhase} tempo={rollerTempo} spinning={spinning} />
            ) : (
              <LuckyWheel
                from={from}
                to={to}
                winner={winner}
                highlightedWinner={highlightedWinner}
                pointerRef={pointerRef}
                wheelRef={wheelRef}
                rotation={rotation}
                spinning={spinning}
                buttonLabel={spinButtonLabel}
                onSpin={spin}
              />
            )}
          </motion.div>

          <div className="mx-auto w-full min-w-0 text-center lg:text-left" style={{ maxWidth: "min(36rem, calc(100vw - 2rem))" }}>
            <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
              <button
                className="gold-button focus-ring rounded-lg px-7 py-4 text-sm uppercase tracking-[0.18em] transition hover:scale-[1.02] active:translate-y-px disabled:opacity-60"
                onClick={spin}
                disabled={spinning}
                aria-label={spinning ? "SPINNING" : spinButtonLabel}
              >
                {spinning ? "SPINNING" : spinButtonLabel}
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
              <p className={messageTone === "danger" ? "danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold" : "mt-4 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-[#dfe6f6]"}>
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
      <WinnerModal result={result} onClose={closeResult} onShare={shareResult} />
    </main>
  );
}

function SeoSections() {
  const sections = [
    ["Free Random Draw Tool", "RandomSpin gives you a polished random draw experience for quick choices, games, giveaways, classroom picks, and friendly draws."],
    ["How Number Draw Works", "Choose a FROM and TO number, press SPIN, and the server determines the result independently of the visual animation."],
    ["Names, Numbers, And More", "Use Number Draw for ranges or switch to Player Draw when you want to paste names and pick a participant."],
    ["Live Draws Made Clear", "RandomSpin keeps the interface readable for phones, desktops, projectors, and livestream-style presentations."]
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
        <p>A free web-based random draw tool for names, numbers, and more.</p>
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
