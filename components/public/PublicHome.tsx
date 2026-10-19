"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CircleDot,
  Maximize2,
  RotateCcw,
  Share2,
  Shuffle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Confetti } from "@/components/public/Confetti";
import { LuckyWheel } from "@/components/public/LuckyWheel";
import { NumberRollerDisplay } from "@/components/public/NumberRollerDisplay";
import { PublicGameNav } from "@/components/public/PublicGameNav";
import {
  RangeSelector,
  type RangeSelectorHandle,
} from "@/components/public/RangeSelector";
import { RecentResults } from "@/components/public/RecentResults";
import {
  WinnerModal,
  type WinnerResult,
} from "@/components/public/WinnerModal";
import { validateDrawRangeValues } from "@/lib/draw-range";
import {
  PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY,
  PRIVATE_DRAW_WHEEL_DISPLAY,
  normalizePrivateDrawDisplayStyle,
  type PrivateDrawDisplayStyle,
} from "@/lib/private-draw-display";
import {
  createDecelerationPlan,
  getDecelerationKinematics,
  getMinimumDecelerationStartMs,
  nextNeutralKinematics,
  type DecelerationPlan,
  type SpinKinematics,
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
      label?: string | null;
      sharePath?: string;
    }
  | {
      kind: "private";
      publicCode: string;
      spinEndpoint: string;
      label?: string;
      displayStyle?: PrivateDrawDisplayStyle;
      rangeEndpoint?: string;
      rangeRevision?: string;
      canEditRange?: boolean;
      canSpin?: boolean;
      sharePath?: string;
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

type PrivateDrawStateResponse = {
  from: number;
  to: number;
  label?: string;
  displayStyle?: PrivateDrawDisplayStyle;
  revision?: string;
};

function isPrivateDrawStateResponse(
  value: unknown,
): value is PrivateDrawStateResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as { from?: unknown }).from) &&
    Number.isInteger((value as { to?: unknown }).to)
  );
}

const NUMBER_ROLLER_FAST_INTERVAL_MS = 52;
const NUMBER_ROLLER_SHUFFLE_INTERVAL_MS = 52;
const NUMBER_ROLLER_SHUFFLE_TRANSITIONS = 7;
const NUMBER_ROLLER_MIN_ACTIVE_MS = 1120;
const NUMBER_ROLLER_REDUCED_MOTION_MIN_ACTIVE_MS = 620;
const NUMBER_ROLLER_FINAL_DELAYS_MS = [100, 140, 190, 260];
const NUMBER_ROLLER_REDUCED_MOTION_FINAL_DELAYS_MS = [180, 260, 340];

function sameRange(
  left: { from: number; to: number },
  right: { from: number; to: number },
) {
  return left.from === right.from && left.to === right.to;
}

function getSequentialNumbers(from: number, to: number) {
  const plan = getWheelVisualPlan(from, to, null);
  return plan.mode === "numbered"
    ? Array.from({ length: plan.rangeSize }, (_, index) => from + index)
    : [];
}

function shuffleNumbers(numbers: readonly number[]) {
  const shuffled = [...numbers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  // A visual shuffle should visibly change a multi-segment wheel, even if a
  // particular random sequence happens to preserve its order.
  if (
    shuffled.length > 1 &&
    shuffled.every((value, index) => value === numbers[index])
  ) {
    shuffled.push(shuffled.shift() as number);
  }

  return shuffled;
}

function hasSameNumberOrder(
  left: readonly number[],
  right: readonly number[],
) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function PublicHome({
  settings,
  initialResults,
  drawMode = { kind: "public", spinEndpoint: "/api/spin", label: null },
}: {
  settings: PublicSettings;
  initialResults: RecentResult[];
  drawMode?: PublicDrawMode;
}) {
  const [from, setFrom] = useState(settings.defaultFrom);
  const [to, setTo] = useState(settings.defaultTo);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [highlightedWinner, setHighlightedWinner] = useState<number | null>(
    null,
  );
  const [result, setResult] = useState<WinnerResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinPreflight, setSpinPreflight] = useState(false);
  const [postRevealShuffleResetPending, setPostRevealShuffleResetPending] =
    useState(false);
  const [hasCompletedSpin, setHasCompletedSpin] = useState(false);
  const [rollerNumber, setRollerNumber] = useState(settings.defaultFrom);
  const [rollerPhase, setRollerPhase] = useState<
    "READY" | "ROLLING" | "WINNING"
  >("READY");
  const [rollerTempo, setRollerTempo] = useState<
    "READY" | "FAST" | "SLOW" | "WINNING"
  >("READY");
  const [rollerShuffleMixing, setRollerShuffleMixing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "danger">(
    "neutral",
  );
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
  const authoritativeRangeRef = useRef({
    from: settings.defaultFrom,
    to: settings.defaultTo,
  });
  const spinActiveRef = useRef(false);
  const postRevealShuffleResetRef = useRef(false);
  const spinStartedAtRef = useRef(0);
  const neutralFrameAtRef = useRef(0);
  const kinematicsRef = useRef<SpinKinematics>({
    angle: rotation,
    velocity: 0,
  });
  const rollerTimerRef = useRef<number | null>(null);
  const rollerShuffleTimerRef = useRef<number | null>(null);
  const rollerShuffleQueueRef = useRef(0);
  const rollerShuffleMixingRef = useRef(false);
  const rollerShuffleLastNumberRef = useRef<number | null>(null);
  const rollerSequenceRef = useRef<number[]>([]);
  const rollerSequenceIndexRef = useRef(0);
  const rollerLastPlaceholderRef = useRef<number | null>(null);
  const fromRangeSelectorRef = useRef<RangeSelectorHandle | null>(null);
  const toRangeSelectorRef = useRef<RangeSelectorHandle | null>(null);
  const saveRangeTimerRef = useRef<number | null>(null);
  const saveRangeInFlightRef =
    useRef<Promise<PrivateDrawStateResponse | null> | null>(null);
  const saveRangeQueuedRef = useRef(false);
  const desiredRangeRef = useRef({
    from: settings.defaultFrom,
    to: settings.defaultTo,
  });
  const lastSavedRangeRef = useRef({
    from: settings.defaultFrom,
    to: settings.defaultTo,
  });
  const rangeRevisionRef = useRef(
    drawMode.kind === "private" ? (drawMode.rangeRevision ?? null) : null,
  );
  const fromRangeEditingRef = useRef(false);
  const toRangeEditingRef = useRef(false);
  const fromRangeDirtyRef = useRef(false);
  const toRangeDirtyRef = useRef(false);
  const suppressRangeCommitSaveRef = useRef(false);
  const lastRangeSaveErrorRef = useRef<string | null>(null);

  const isPrivateDraw = drawMode.kind === "private";
  const canEditPrivateRange =
    drawMode.kind === "private" &&
    drawMode.canEditRange === true &&
    Boolean(drawMode.rangeEndpoint);
  const canSpinDraw = drawMode.kind === "public" || drawMode.canSpin !== false;
  const publicRangeValidationMessage = useMemo(() => {
    if (isPrivateDraw) {
      return null;
    }

    return validateDrawRangeValues({
      from,
      to,
      maximumRangeSize: settings.maximumAllowedRange,
    });
  }, [isPrivateDraw, from, to, settings.maximumAllowedRange]);
  const rangeInvalid = publicRangeValidationMessage !== null;
  const spinButtonLabel = hasCompletedSpin ? "SPIN AGAIN" : "SPIN";
  const spinEndpoint = drawMode.spinEndpoint ?? "/api/spin";
  const initialDrawModeLabel =
    drawMode.kind === "private"
      ? (drawMode.label ?? "RANDOM DRAW")
      : (drawMode.label ?? "RANDOM DRAW");
  const [liveDrawModeLabel, setLiveDrawModeLabel] =
    useState(initialDrawModeLabel);
  const drawModeLabel =
    drawMode.kind === "private" ? liveDrawModeLabel : initialDrawModeLabel;
  const configuredViewMode =
    drawMode.kind === "private"
      ? normalizePrivateDrawDisplayStyle(drawMode.displayStyle)
      : PRIVATE_DRAW_WHEEL_DISPLAY;
  const initialViewMode =
    configuredViewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY
      ? PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY
      : PRIVATE_DRAW_WHEEL_DISPLAY;
  const [viewMode, setViewMode] =
    useState<PrivateDrawDisplayStyle>(initialViewMode);
  const showNumberRoller = viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY;
  const spinBusy =
    spinPreflight || spinning || postRevealShuffleResetPending;
  const [rangeSaveMessage, setRangeSaveMessage] = useState<string | null>(null);
  const [rangeSaveTone, setRangeSaveTone] = useState<"neutral" | "danger">(
    "neutral",
  );
  const [rangeDraftResetKey, setRangeDraftResetKey] = useState(0);
  const [visibleWheelNumbers, setVisibleWheelNumbers] = useState(() =>
    getSequentialNumbers(settings.defaultFrom, settings.defaultTo),
  );
  const [shuffleCount, setShuffleCount] = useState(0);
  const numberSetKey = `${from}:${to}`;
  const numberShuffleSessionKey = `randomspin:number-shuffle:${
    drawMode.kind === "private" ? drawMode.publicCode : "public"
  }`;
  const previousNumberSetKeyRef = useRef(numberSetKey);
  const loadedNumberShuffleSessionRef = useRef<string | null>(null);
  const skipNumberShufflePersistRef = useRef<string | null>(null);
  const numberShuffleRangeResetRef = useRef(false);

  const hasActiveRangeDraft = useCallback(() => {
    return (
      fromRangeEditingRef.current ||
      toRangeEditingRef.current ||
      fromRangeDirtyRef.current ||
      toRangeDirtyRef.current ||
      fromRangeSelectorRef.current?.isDirty() === true ||
      toRangeSelectorRef.current?.isDirty() === true ||
      fromRangeSelectorRef.current?.isEditing() === true ||
      toRangeSelectorRef.current?.isEditing() === true
    );
  }, []);

  const updateFromRangeEditingState = useCallback((editing: boolean) => {
    fromRangeEditingRef.current = editing;
  }, []);

  const updateToRangeEditingState = useCallback((editing: boolean) => {
    toRangeEditingRef.current = editing;
  }, []);

  const updateFromRangeDirtyState = useCallback((dirty: boolean) => {
    fromRangeDirtyRef.current = dirty;
  }, []);

  const updateToRangeDirtyState = useCallback((dirty: boolean) => {
    toRangeDirtyRef.current = dirty;
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "lucky-spin-sound",
      soundEnabled ? "on" : "off",
    );
  }, [soundEnabled]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    authoritativeRangeRef.current = { from, to };
  }, [from, to]);

  useEffect(() => {
    if (previousNumberSetKeyRef.current === numberSetKey) {
      return;
    }

    previousNumberSetKeyRef.current = numberSetKey;
    numberShuffleRangeResetRef.current = true;
    setVisibleWheelNumbers(getSequentialNumbers(from, to));
    setShuffleCount(0);
  }, [from, numberSetKey, to]);

  useEffect(() => {
    if (loadedNumberShuffleSessionRef.current === numberShuffleSessionKey) {
      return;
    }

    loadedNumberShuffleSessionRef.current = numberShuffleSessionKey;
    try {
      const stored = window.sessionStorage.getItem(numberShuffleSessionKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as {
        range?: string;
        count?: number;
        order?: number[];
      };
      if (
        parsed.range !== numberSetKey ||
        typeof parsed.count !== "number" ||
        !Number.isInteger(parsed.count)
      ) {
        return;
      }

      const expectedOrder = getSequentialNumbers(from, to);
      const storedOrder = parsed.order;
      const isValidOrder =
        Array.isArray(storedOrder) &&
        storedOrder.length === expectedOrder.length &&
        storedOrder.every((value) => expectedOrder.includes(value)) &&
        new Set(storedOrder).size === expectedOrder.length;
      setShuffleCount(Math.max(0, parsed.count));
      if (isValidOrder && storedOrder) {
        setVisibleWheelNumbers(storedOrder);
      }
      skipNumberShufflePersistRef.current = numberShuffleSessionKey;
    } catch {
      // Session storage is optional presentation state.
    }
  }, [from, numberSetKey, numberShuffleSessionKey, to]);

  useEffect(() => {
    if (loadedNumberShuffleSessionRef.current !== numberShuffleSessionKey) {
      return;
    }
    if (skipNumberShufflePersistRef.current === numberShuffleSessionKey) {
      skipNumberShufflePersistRef.current = null;
      return;
    }
    if (numberShuffleRangeResetRef.current) {
      numberShuffleRangeResetRef.current = false;
      return;
    }

    try {
      window.sessionStorage.setItem(
        numberShuffleSessionKey,
        JSON.stringify({
          range: numberSetKey,
          count: shuffleCount,
          order: visibleWheelNumbers,
        }),
      );
    } catch {
      // Session storage is optional presentation state.
    }
  }, [
    numberSetKey,
    numberShuffleSessionKey,
    shuffleCount,
    visibleWheelNumbers,
  ]);

  useEffect(() => {
    if (!result || !postRevealShuffleResetRef.current) {
      return;
    }

    postRevealShuffleResetRef.current = false;
    setShuffleCount(0);
    setPostRevealShuffleResetPending(false);
    spinActiveRef.current = false;
  }, [result]);

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

  const applyPrivateDrawState = useCallback(
    (state: PrivateDrawStateResponse) => {
      if (!Number.isInteger(state.from) || !Number.isInteger(state.to)) {
        return null;
      }

      const normalizedState = {
        from: state.from,
        to: state.to,
        label: state.label,
        displayStyle: state.displayStyle,
        revision: state.revision,
      };

      authoritativeRangeRef.current = {
        from: normalizedState.from,
        to: normalizedState.to,
      };
      lastSavedRangeRef.current = {
        from: normalizedState.from,
        to: normalizedState.to,
      };
      if (normalizedState.revision) {
        rangeRevisionRef.current = normalizedState.revision;
      }
      setFrom(normalizedState.from);
      setTo(normalizedState.to);
      if (!spinActiveRef.current) {
        setRollerNumber(normalizedState.from);
      }
      if (normalizedState.label) {
        setLiveDrawModeLabel(normalizedState.label);
      }

      return normalizedState;
    },
    [],
  );

  const validateEditablePrivateRange = useCallback(
    (range: { from: number; to: number }) => {
      if (range.from < 0 || range.to < 0) {
        return "Live draw range cannot use negative numbers.";
      }

      return validateDrawRangeValues({
        from: range.from,
        to: range.to,
        maximumRangeSize: settings.maximumAllowedRange,
      });
    },
    [settings.maximumAllowedRange],
  );

  const refreshPrivateDrawState = useCallback(
    async (options: { forceApply?: boolean } = {}) => {
      if (drawMode.kind !== "private") {
        return null;
      }

      const response = await fetch(drawMode.spinEndpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok || !isPrivateDrawStateResponse(data)) {
        return null;
      }

      if (canEditPrivateRange && !options.forceApply && hasActiveRangeDraft()) {
        return data;
      }

      return applyPrivateDrawState(data);
    },
    [applyPrivateDrawState, canEditPrivateRange, drawMode, hasActiveRangeDraft],
  );

  const savePrivateDrawRange = useCallback(
    async (requestedRange: { from: number; to: number }) => {
      if (
        drawMode.kind !== "private" ||
        !canEditPrivateRange ||
        !drawMode.rangeEndpoint
      ) {
        return null;
      }

      const rangeEndpoint = drawMode.rangeEndpoint;
      desiredRangeRef.current = requestedRange;
      const validationMessage = validateEditablePrivateRange(requestedRange);
      if (validationMessage) {
        lastRangeSaveErrorRef.current = validationMessage;
        setRangeSaveTone("danger");
        setRangeSaveMessage(validationMessage);
        return null;
      }

      if (
        !saveRangeInFlightRef.current &&
        sameRange(requestedRange, lastSavedRangeRef.current)
      ) {
        return {
          from: lastSavedRangeRef.current.from,
          to: lastSavedRangeRef.current.to,
          label: liveDrawModeLabel,
          displayStyle: viewMode,
          revision: rangeRevisionRef.current ?? undefined,
        };
      }

      if (saveRangeInFlightRef.current) {
        saveRangeQueuedRef.current = true;
        return saveRangeInFlightRef.current;
      }

      const savePromise = (async () => {
        let rangeToSave = requestedRange;

        for (;;) {
          saveRangeQueuedRef.current = false;
          lastRangeSaveErrorRef.current = null;
          setRangeSaveMessage(null);

          const response = await fetch(rangeEndpoint, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              from: rangeToSave.from,
              to: rangeToSave.to,
              revision: rangeRevisionRef.current,
            }),
          });
          const data = (await response.json().catch(() => null)) as
            | PrivateDrawStateResponse
            | { error?: string; current?: PrivateDrawStateResponse | null }
            | null;

          if (!response.ok || !data || !isPrivateDrawStateResponse(data)) {
            if (
              data &&
              typeof data === "object" &&
              "current" in data &&
              data.current &&
              isPrivateDrawStateResponse(data.current)
            ) {
              applyPrivateDrawState(data.current);
            } else {
              await refreshPrivateDrawState({ forceApply: true });
            }

            const errorMessage =
              data &&
              typeof data === "object" &&
              "error" in data &&
              typeof data.error === "string"
                ? data.error
                : "Unable to update range";
            lastRangeSaveErrorRef.current = errorMessage;
            setRangeSaveTone("danger");
            setRangeSaveMessage(errorMessage);
            return null;
          }

          const savedState = applyPrivateDrawState(data);
          lastRangeSaveErrorRef.current = null;
          setRangeSaveMessage(null);

          if (
            !saveRangeQueuedRef.current ||
            sameRange(desiredRangeRef.current, { from: data.from, to: data.to })
          ) {
            return savedState;
          }

          rangeToSave = desiredRangeRef.current;
        }
      })();

      saveRangeInFlightRef.current = savePromise;
      try {
        return await savePromise;
      } finally {
        if (saveRangeInFlightRef.current === savePromise) {
          saveRangeInFlightRef.current = null;
        }
      }
    },
    [
      applyPrivateDrawState,
      canEditPrivateRange,
      drawMode,
      liveDrawModeLabel,
      refreshPrivateDrawState,
      validateEditablePrivateRange,
      viewMode,
    ],
  );

  const commitEditablePrivateRange = useCallback(
    (range: { from: number; to: number }) => {
      if (!canEditPrivateRange || suppressRangeCommitSaveRef.current) {
        return;
      }

      if (saveRangeTimerRef.current !== null) {
        window.clearTimeout(saveRangeTimerRef.current);
        saveRangeTimerRef.current = null;
      }

      void savePrivateDrawRange(range);
    },
    [canEditPrivateRange, savePrivateDrawRange],
  );

  const restoreEditableRangeDrafts = useCallback(() => {
    fromRangeSelectorRef.current?.restoreDraft();
    toRangeSelectorRef.current?.restoreDraft();
    fromRangeEditingRef.current = false;
    toRangeEditingRef.current = false;
    fromRangeDirtyRef.current = false;
    toRangeDirtyRef.current = false;
  }, []);

  const commitEditableRangeDrafts = useCallback(() => {
    suppressRangeCommitSaveRef.current = true;
    try {
      const committedFrom = fromRangeSelectorRef.current?.commitDraft();
      const committedTo = toRangeSelectorRef.current?.commitDraft();

      if (committedFrom === null || committedTo === null) {
        restoreEditableRangeDrafts();
        return null;
      }

      return { from: committedFrom ?? from, to: committedTo ?? to };
    } finally {
      suppressRangeCommitSaveRef.current = false;
    }
  }, [from, restoreEditableRangeDrafts, to]);

  useEffect(() => {
    if (drawMode.kind !== "private") {
      return;
    }

    const syncOnFocus = () => {
      if (!spinActiveRef.current) {
        if (canEditPrivateRange && hasActiveRangeDraft()) {
          return;
        }

        if (
          canEditPrivateRange &&
          !sameRange(desiredRangeRef.current, lastSavedRangeRef.current)
        ) {
          void savePrivateDrawRange(desiredRangeRef.current);
          return;
        }

        void refreshPrivateDrawState();
      }
    };

    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnFocus);

    return () => {
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnFocus);
    };
  }, [
    canEditPrivateRange,
    drawMode.kind,
    hasActiveRangeDraft,
    refreshPrivateDrawState,
    savePrivateDrawRange,
  ]);

  useEffect(() => {
    if (!canEditPrivateRange || spinActiveRef.current) {
      return;
    }

    const requestedRange = { from, to };
    desiredRangeRef.current = requestedRange;

    if (sameRange(requestedRange, lastSavedRangeRef.current)) {
      return;
    }

    if (saveRangeTimerRef.current !== null) {
      window.clearTimeout(saveRangeTimerRef.current);
    }

    saveRangeTimerRef.current = window.setTimeout(() => {
      saveRangeTimerRef.current = null;
      void savePrivateDrawRange(requestedRange);
    }, 300);

    return () => {
      if (saveRangeTimerRef.current !== null) {
        window.clearTimeout(saveRangeTimerRef.current);
        saveRangeTimerRef.current = null;
      }
    };
  }, [canEditPrivateRange, from, savePrivateDrawRange, to]);

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

      if (rollerShuffleTimerRef.current !== null) {
        window.clearTimeout(rollerShuffleTimerRef.current);
      }

      if (saveRangeTimerRef.current !== null) {
        window.clearTimeout(saveRangeTimerRef.current);
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
    pointerRef.current?.animate?.(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-5deg)" },
        { transform: "rotate(2deg)" },
        { transform: "rotate(0deg)" },
      ],
      {
        duration: 170,
        easing: "ease-out",
      },
    );
  }

  function getAudioContext() {
    if (!soundEnabled) {
      return null;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
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
    bodyGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (final ? 0.095 : 0.055),
    );

    click.type = "square";
    click.frequency.setValueAtTime(final ? 360 : 290, now);
    clickGain.gain.setValueAtTime(final ? 0.05 : 0.032, now);
    clickGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (final ? 0.045 : 0.03),
    );

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
      { frequency: 783.99, at: 0.44, duration: 0.62, gain: 0.052 },
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

  function playWinnerSoundSafely() {
    try {
      playWinnerSound();
    } catch {
      console.warn("Winner sound unavailable; continuing result presentation.");
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
      const next = nextNeutralKinematics(
        kinematicsRef.current,
        deltaMs,
        elapsed,
        prefersReducedMotion(),
      );
      const nextRotation = next.angle;
      const boundary = Math.floor(nextRotation / segmentAngle);

      if (
        !prefersReducedMotion() &&
        boundary !== previousBoundary &&
        timestamp - lastTickAt >= minimumTickGap
      ) {
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
    const range = authoritativeRangeRef.current;
    const rangeSize = Math.max(range.to - range.from + 1, 1);
    const values = Array.from(
      { length: rangeSize },
      (_, index) => range.from + index,
    );

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

    const next =
      rollerSequenceRef.current[rollerSequenceIndexRef.current] ??
      authoritativeRangeRef.current.from;
    rollerSequenceIndexRef.current += 1;
    return next;
  }

  function getNextRollerPlaceholder(avoidValue?: number) {
    let next = takeRollerSequenceCandidate();
    const range = authoritativeRangeRef.current;

    if (
      range.to > range.from &&
      (next === rollerLastPlaceholderRef.current || next === avoidValue)
    ) {
      const maxAttempts = Math.max(range.to - range.from + 1, 2) + 1;
      let fallback = next;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = takeRollerSequenceCandidate();
        if (
          candidate !== rollerLastPlaceholderRef.current &&
          candidate !== avoidValue
        ) {
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
      rollerTimerRef.current = window.setTimeout(
        tick,
        prefersReducedMotion() ? 180 : NUMBER_ROLLER_FAST_INTERVAL_MS,
      );
    };

    rollerTimerRef.current = window.setTimeout(
      tick,
      prefersReducedMotion() ? 180 : NUMBER_ROLLER_FAST_INTERVAL_MS,
    );
  }

  function getNextRollerShuffleNumber() {
    const rangeSize = Math.max(to - from + 1, 1);
    let next = from + Math.floor(Math.random() * rangeSize);

    if (rangeSize > 1 && next === rollerShuffleLastNumberRef.current) {
      next = from + ((next - from + 1) % rangeSize);
    }

    rollerShuffleLastNumberRef.current = next;
    return next;
  }

  function runQueuedRollerShuffle() {
    if (rollerShuffleQueueRef.current <= 0) {
      rollerShuffleMixingRef.current = false;
      setRollerShuffleMixing(false);
      return;
    }

    rollerShuffleQueueRef.current -= 1;
    rollerShuffleMixingRef.current = true;
    setRollerShuffleMixing(true);
    setRollerNumber(getNextRollerShuffleNumber());
    let transitions = 1;

    const tick = () => {
      if (transitions >= NUMBER_ROLLER_SHUFFLE_TRANSITIONS) {
        rollerShuffleTimerRef.current = null;
        runQueuedRollerShuffle();
        return;
      }

      setRollerNumber(getNextRollerShuffleNumber());
      transitions += 1;
      rollerShuffleTimerRef.current = window.setTimeout(
        tick,
        NUMBER_ROLLER_SHUFFLE_INTERVAL_MS,
      );
    };

    rollerShuffleTimerRef.current = window.setTimeout(
      tick,
      NUMBER_ROLLER_SHUFFLE_INTERVAL_MS,
    );
  }

  function queueRollerShuffle() {
    rollerShuffleQueueRef.current += 1;
    if (!rollerShuffleMixingRef.current) {
      runQueuedRollerShuffle();
    }
  }

  function finishNumberRoller(winningNumber: number, onComplete: () => void) {
    const beginFinalSlowdown = () => {
      clearSpinTimers();
      setRollerPhase("ROLLING");
      setRollerTempo("SLOW");

      const delays = prefersReducedMotion()
        ? NUMBER_ROLLER_REDUCED_MOTION_FINAL_DELAYS_MS
        : NUMBER_ROLLER_FINAL_DELAYS_MS;
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
        rollerTimerRef.current = window.setTimeout(
          tick,
          delays[index] ?? delays[delays.length - 1],
        );
      };

      rollerTimerRef.current = window.setTimeout(tick, delays[0]);
    };

    const waitForMinimumRolling = () => {
      const minimumActiveMs = prefersReducedMotion()
        ? NUMBER_ROLLER_REDUCED_MOTION_MIN_ACTIVE_MS
        : NUMBER_ROLLER_MIN_ACTIVE_MS;
      const elapsed = performance.now() - spinStartedAtRef.current;

      if (elapsed < minimumActiveMs) {
        decelerationWaitTimerRef.current = window.setTimeout(
          waitForMinimumRolling,
          Math.min(minimumActiveMs - elapsed, 90),
        );
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
    finalTick = false,
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

      if (
        !prefersReducedMotion() &&
        boundary !== previousBoundary &&
        timestamp - lastTickAt >= minTickGap
      ) {
        playSegmentTick(false);
        lastTickAt = timestamp;
      }

      previousBoundary = boundary;
      kinematicsRef.current = next;
      applyWheelRotation(nextRotation);

      if (
        process.env.NODE_ENV === "development" &&
        next.velocity > previousVelocity + 0.5
      ) {
        console.warn("RandomSpin velocity increased during deceleration.", {
          previousVelocity,
          nextVelocity: next.velocity,
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
    from,
    to,
    renderedSegmentCount,
    visualNumberOrder,
    onComplete,
  }: {
    winner: number;
    from: number;
    to: number;
    renderedSegmentCount: number;
    visualNumberOrder: readonly number[];
    onComplete: () => void;
  }) {
    const waitForDeceleration = () => {
      const elapsed = performance.now() - spinStartedAtRef.current;
      const decelerationStartMs = getMinimumDecelerationStartMs(
        elapsed,
        prefersReducedMotion(),
      );

      if (elapsed < decelerationStartMs) {
        decelerationWaitTimerRef.current = window.setTimeout(
          waitForDeceleration,
          Math.min(decelerationStartMs - elapsed, 80),
        );
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
        reducedMotion: prefersReducedMotion(),
        visualNumberOrder,
      });
      animateDeceleration({
        plan,
        renderedSegmentCount,
        finalTick: true,
        onComplete,
      });
    };

    waitForDeceleration();
  }

  async function spin() {
    if (spinActiveRef.current || rollerShuffleMixingRef.current) {
      return;
    }

    spinActiveRef.current = true;
    setSpinPreflight(true);

    if (!canSpinDraw) {
      setMessageTone("danger");
      setMessage("Operator sign-in is required to run this draw.");
      spinActiveRef.current = false;
      setSpinPreflight(false);
      return;
    }

    let activeFrom = from;
    let activeTo = to;
    try {
      if (drawMode.kind === "private") {
        if (canEditPrivateRange) {
          if (saveRangeTimerRef.current !== null) {
            window.clearTimeout(saveRangeTimerRef.current);
            saveRangeTimerRef.current = null;
          }

          const requestedRange = commitEditableRangeDrafts();
          if (!requestedRange) {
            setMessageTone("danger");
            setMessage("Enter a whole number.");
            spinActiveRef.current = false;
            setSpinPreflight(false);
            return;
          }

          const validationMessage =
            validateEditablePrivateRange(requestedRange);
          if (validationMessage) {
            setRangeSaveTone("danger");
            setRangeSaveMessage(validationMessage);
            setMessageTone("danger");
            setMessage(validationMessage);
            lastRangeSaveErrorRef.current = validationMessage;
            spinActiveRef.current = false;
            setSpinPreflight(false);
            return;
          }

          const rangeNeedsSave = !sameRange(
            requestedRange,
            lastSavedRangeRef.current,
          );
          const savedState = rangeNeedsSave
            ? await savePrivateDrawRange(requestedRange)
            : await refreshPrivateDrawState();
          if (!savedState) {
            setMessageTone("danger");
            setMessage(
              rangeNeedsSave
                ? (lastRangeSaveErrorRef.current ?? "Unable to update range")
                : "Unable to refresh the live draw range. Please try again.",
            );
            spinActiveRef.current = false;
            setSpinPreflight(false);
            return;
          }

          activeFrom = savedState.from;
          activeTo = savedState.to;
        } else {
          const syncedState = await refreshPrivateDrawState();
          if (!syncedState) {
            setMessageTone("danger");
            setMessage(
              "Unable to refresh the live draw range. Please try again.",
            );
            spinActiveRef.current = false;
            setSpinPreflight(false);
            return;
          }

          activeFrom = syncedState.from;
          activeTo = syncedState.to;
        }
      }

      if (rangeInvalid) {
        setMessageTone("danger");
        setMessage(publicRangeValidationMessage);
        spinActiveRef.current = false;
        setSpinPreflight(false);
        return;
      }
    } catch {
      setMessageTone("danger");
      setMessage("Unable to refresh the live draw range. Please try again.");
      spinActiveRef.current = false;
      setSpinPreflight(false);
      return;
    }

    let visualNumberOrderForSpin = visibleWheelNumbers;
    if (!showNumberRoller) {
      const sequentialNumbers = getSequentialNumbers(activeFrom, activeTo);
      const currentOrder =
        visibleWheelNumbers.length === sequentialNumbers.length &&
        visibleWheelNumbers.every((value) => sequentialNumbers.includes(value))
          ? visibleWheelNumbers
          : sequentialNumbers;
      const shouldNormalizeCompletedOrder =
        shuffleCount === 0 &&
        !hasSameNumberOrder(currentOrder, sequentialNumbers);
      visualNumberOrderForSpin = shouldNormalizeCompletedOrder
        ? sequentialNumbers
        : currentOrder;

      if (!hasSameNumberOrder(visibleWheelNumbers, visualNumberOrderForSpin)) {
        setVisibleWheelNumbers(visualNumberOrderForSpin);
      }
    }

    setSpinPreflight(false);
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
    authoritativeRangeRef.current = { from: activeFrom, to: activeTo };
    if (showNumberRoller) {
      startNeutralRoller();
    } else {
      startNeutralSpin(
        getWheelVisualPlan(activeFrom, activeTo, null).renderedSegmentCount,
      );
    }

    try {
      const response = await fetch(spinEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          drawMode.kind === "private" ? {} : { from: activeFrom, to: activeTo },
        ),
      });
      const data = (await response.json()) as SpinResponse | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Spin failed.");
      }

      const resultFrom = data.from ?? activeFrom;
      const resultTo = data.to ?? activeTo;
      const effectiveFrom =
        drawMode.kind === "private" ? resultFrom : activeFrom;
      const effectiveTo = drawMode.kind === "private" ? resultTo : activeTo;
      const spinResult = {
        winner: data.winner,
        spinId: data.spinId,
        timestamp: data.timestamp,
        from: resultFrom,
        to: resultTo,
      };
      setWinner(data.winner);
      authoritativeRangeRef.current = { from: effectiveFrom, to: effectiveTo };
      const completedRoundLabel =
        data.mode === "OPERATOR"
          ? "OPERATOR DRAW"
          : data.mode === "RANDOM"
            ? "RANDOM DRAW"
            : null;
      if (drawMode.kind === "private") {
        setFrom(resultFrom);
        setTo(resultTo);
        if (completedRoundLabel) {
          setLiveDrawModeLabel(completedRoundLabel);
        }
      }

      const completeSpin = () => {
        celebrationTimerRef.current = window.setTimeout(
          () => {
            setHighlightedWinner(data.winner);
            setResult(spinResult);
            setHasCompletedSpin(true);
            setRecent((current) =>
              [
                { winner: data.winner, timestamp: data.timestamp },
                ...current,
              ].slice(0, 10),
            );
            // Keep the landed order in place for the completed result. The
            // next draw cycle will normalize it before it begins.
            postRevealShuffleResetRef.current = true;
            setPostRevealShuffleResetPending(true);
            if (drawMode.kind === "private" && data.nextLabel) {
              setLiveDrawModeLabel(data.nextLabel);
            }

            if (settings.confettiEnabled && !prefersReducedMotion()) {
              setConfetti(true);
              confettiTimerRef.current = window.setTimeout(
                () => setConfetti(false),
                2200,
              );
            }

            // The wheel order and controls remain locked until the winner is
            // visibly established, so the stopped pointer cannot be remapped.
            setSpinning(false);
            setSpinPreflight(false);
            playWinnerSoundSafely();
          },
          showNumberRoller ? 1200 : 380,
        );
      };

      if (showNumberRoller) {
        finishNumberRoller(data.winner, completeSpin);
      } else {
        const visualPlan = getWheelVisualPlan(
          effectiveFrom,
          effectiveTo,
          data.winner,
        );
        finishWithServerWinner({
          winner: data.winner,
          from: effectiveFrom,
          to: effectiveTo,
          renderedSegmentCount: visualPlan.renderedSegmentCount,
          visualNumberOrder: visualNumberOrderForSpin,
          onComplete: completeSpin,
        });
      }
    } catch (error) {
      clearSpinTimers();
      if (showNumberRoller) {
        spinActiveRef.current = false;
        setSpinning(false);
        setSpinPreflight(false);
        setRollerPhase("READY");
        setRollerTempo("READY");
        setMessageTone("danger");
        setMessage("Unable to complete this spin. Please try again.");
        return;
      }

      const stopRotation =
        rotationRef.current + (prefersReducedMotion() ? 45 : 180);
      const distance = stopRotation - rotationRef.current;
      const stopVelocity = Math.max(
        kinematicsRef.current.velocity,
        prefersReducedMotion() ? 120 : 420,
      );
      animateDeceleration({
        plan: {
          targetRotation: stopRotation,
          durationMs: (2 * distance * 1000) / stopVelocity,
          initialVelocity: stopVelocity,
        },
        renderedSegmentCount: getWheelVisualPlan(from, to, null)
          .renderedSegmentCount,
        onComplete: () => {
          setSpinning(false);
          spinActiveRef.current = false;
          setSpinPreflight(false);
          setMessageTone("danger");
          setMessage(
            error instanceof Error
              ? "Unable to complete this spin. Please try again."
              : "Unable to complete this spin. Please try again.",
          );
        },
      });
    }
  }

  function closeResult() {
    setResult(null);
  }

  async function shareResult() {
    if (winner === null) {
      return;
    }

    const sharePath = drawMode.sharePath ?? "/";
    const shareUrl = `${window.location.origin}${sharePath}`;
    const text = `I used RandomSpin and got number ${winner}!`;
    if (navigator.share) {
      await navigator.share({ title: "RandomSpin", text, url: shareUrl });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
    setMessageTone("neutral");
    setMessage("Result link copied.");
  }

  function reset() {
    if (spinActiveRef.current || rollerShuffleMixingRef.current) {
      return;
    }

    clearSpinTimers();
    const resetRange =
      drawMode.kind === "private"
        ? lastSavedRangeRef.current
        : { from: settings.defaultFrom, to: settings.defaultTo };
    setFrom(resetRange.from);
    setTo(resetRange.to);
    setRangeDraftResetKey((current) => current + 1);
    setWinner(null);
    setHighlightedWinner(null);
    setResult(null);
    setMessageTone("neutral");
    setMessage(null);
    setConfetti(false);
    setSpinning(false);
    setSpinPreflight(false);
    setHasCompletedSpin(false);
    setRollerNumber(resetRange.from);
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
    if (spinActiveRef.current || spinBusy || rollerShuffleMixingRef.current) {
      return;
    }

    setViewMode(nextView);
  }

  function shuffleNumberWheel() {
    if (spinActiveRef.current || spinBusy || !canSpinDraw) {
      return;
    }

    setShuffleCount((current) => current + 1);
    if (showNumberRoller) {
      queueRollerShuffle();
      return;
    }

    setVisibleWheelNumbers((current) => {
      const sequentialNumbers = getSequentialNumbers(from, to);
      const currentOrder =
        current.length === sequentialNumbers.length &&
        current.every((value) => sequentialNumbers.includes(value))
          ? current
          : sequentialNumbers;
      const freshShuffleBase =
        shuffleCount === 0 ? sequentialNumbers : currentOrder;
      return shuffleNumbers(freshShuffleBase);
    });
  }

  function resetShuffleCount() {
    if (spinning || rollerShuffleMixingRef.current) {
      return;
    }

    setShuffleCount(0);
  }

  return (
    <main className="premium-shell">
      <Confetti active={confetti} />
      <div className="livestream-page-frame mx-auto flex w-full max-w-7xl flex-col">
        <header className="presentation-chrome flex flex-wrap items-center justify-between gap-3">
          <BrandMark />
          <div className="flex items-center gap-3">
            <PublicGameNav active="spin" />
            <nav
              className="hidden items-center gap-5 text-sm font-bold text-[#aeb7ca] md:flex"
              aria-label="Public navigation"
            >
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
          <div className="event-announcement presentation-chrome mx-auto mt-6 max-w-2xl rounded-xl px-4 py-3 text-center text-sm font-semibold">
            {settings.announcement}
          </div>
        ) : null}

        <section className="livestream-hero-grid">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full min-w-0 text-center lg:text-left"
            style={{ maxWidth: "min(36rem, calc(100vw - 2rem))" }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f6d98f]">
                {settings.siteName}
              </p>
              {drawModeLabel ? (
                <span className="event-status-pill rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#dfe6f6]">
                  {drawModeLabel}
                </span>
              ) : null}
            </div>
            <h1 className="event-headline mx-auto font-[var(--font-display)] font-black uppercase leading-[0.96] text-white lg:mx-0">
              {settings.headline}
            </h1>
            <p className="event-subtitle mt-4 text-base font-medium text-[#aeb7ca] sm:text-xl lg:mt-5">
              {settings.subtitle}
            </p>
            <p className="event-intro mt-3 max-w-xl text-sm leading-6 text-[#7f8aa3] max-[480px]:hidden">
              Use RandomSpin to spin numbers, pick random players, and run
              simple live draws in a clean web-based experience.
            </p>

            <div className="livestream-range-controls mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-8">
              <RangeSelector
                ref={fromRangeSelectorRef}
                label="From"
                value={from}
                onChange={setFrom}
                onCommit={(value) =>
                  commitEditablePrivateRange({ from: value, to })
                }
                onEditingChange={updateFromRangeEditingState}
                onDirtyChange={updateFromRangeDirtyState}
                resetKey={rangeDraftResetKey}
                readOnly={drawMode.kind === "private" && !canEditPrivateRange}
              />
              <RangeSelector
                ref={toRangeSelectorRef}
                label="To"
                value={to}
                onChange={setTo}
                onCommit={(value) =>
                  commitEditablePrivateRange({ from, to: value })
                }
                onEditingChange={updateToRangeEditingState}
                onDirtyChange={updateToRangeDirtyState}
                resetKey={rangeDraftResetKey}
                readOnly={drawMode.kind === "private" && !canEditPrivateRange}
              />
            </div>
            {canEditPrivateRange &&
            rangeSaveMessage &&
            rangeSaveTone === "danger" ? (
              <p
                className="mt-3 text-sm font-bold text-[var(--rose)]"
                role="alert"
              >
                {rangeSaveMessage}
              </p>
            ) : null}
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            className="relative min-w-0 md:row-span-2"
          >
            <div className="relative z-20 mb-3 flex justify-center lg:justify-end">
              <div
                className="view-mode-control inline-grid grid-cols-2 overflow-hidden rounded-full p-1"
                aria-label="View mode"
              >
                <button
                  className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-4 ${
                    viewMode === PRIVATE_DRAW_WHEEL_DISPLAY
                      ? "view-mode-button-active"
                      : "view-mode-button-idle"
                  }`}
                  type="button"
                  disabled={spinBusy || rollerShuffleMixing}
                  aria-pressed={viewMode === PRIVATE_DRAW_WHEEL_DISPLAY}
                  onClick={() => switchView(PRIVATE_DRAW_WHEEL_DISPLAY)}
                >
                  <CircleDot className="size-4 text-[#2563eb]" />
                  Wheel
                </button>
                <button
                  className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-4 ${
                    viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY
                      ? "view-mode-button-active"
                      : "view-mode-button-idle"
                  }`}
                  type="button"
                  disabled={spinBusy || rollerShuffleMixing}
                  aria-pressed={viewMode === PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY}
                  onClick={() => switchView(PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY)}
                >
                  <span
                    className="text-xs font-black text-[#2563eb]"
                    aria-hidden="true"
                  >
                    123
                  </span>
                  Number
                </button>
              </div>
            </div>
            <div
              className="absolute inset-10 rounded-full bg-[rgba(37,99,235,0.12)] blur-3xl"
              aria-hidden="true"
            />
            {showNumberRoller ? (
              <NumberRollerDisplay
                from={from}
                to={to}
                currentNumber={rollerNumber}
                phase={rollerPhase}
                tempo={rollerTempo}
                spinning={spinning}
                shuffling={rollerShuffleMixing}
              />
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
                canSpin={canSpinDraw && !spinPreflight}
                buttonLabel={spinButtonLabel}
                visibleNumbers={visibleWheelNumbers}
                onSpin={spin}
              />
            )}
          </motion.div>

          <div
            className="mx-auto w-full min-w-0 text-center lg:text-left"
            style={{ maxWidth: "min(36rem, calc(100vw - 2rem))" }}
          >
            <div className="mt-3 flex flex-wrap justify-center gap-3 sm:mt-5 md:justify-start">
              <button
                className="gold-button focus-ring min-h-12 w-full max-w-[18rem] rounded-xl px-7 py-4 text-sm uppercase tracking-[0.18em] transition hover:scale-[1.02] active:translate-y-px disabled:opacity-60 sm:w-auto sm:min-w-[11rem]"
                onClick={spin}
                disabled={spinBusy || rollerShuffleMixing || !canSpinDraw}
                aria-label={spinBusy ? "SPINNING" : rollerShuffleMixing ? "MIXING NUMBERS" : spinButtonLabel}
              >
                {spinBusy ? "SPINNING" : rollerShuffleMixing ? "MIXING" : spinButtonLabel}
              </button>
              <button
                className="event-action focus-ring flex min-h-12 items-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                type="button"
                onClick={shuffleNumberWheel}
                disabled={spinBusy || !canSpinDraw}
                aria-label={`Shuffle numbers, count ${shuffleCount}`}
              >
                <Shuffle className="size-4 text-[#f6d98f]" />
                SHUFFLE {shuffleCount}×
              </button>
              <button
                className="event-action focus-ring min-h-12 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                type="button"
                onClick={resetShuffleCount}
                disabled={spinBusy || rollerShuffleMixing || shuffleCount === 0}
                aria-label="Reset shuffle count"
              >
                RESET COUNT
              </button>
              <button
                className="event-icon-action focus-ring size-12 rounded-xl text-white"
                onClick={reset}
                disabled={spinBusy || rollerShuffleMixing}
                aria-label="Reset"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                className="event-icon-action focus-ring size-12 rounded-xl text-white"
                onClick={() => setSoundEnabled((value) => !value)}
                aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
              >
                {soundEnabled ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </button>
              <button
                className="event-icon-action focus-ring size-12 rounded-xl text-white"
                onClick={() => document.documentElement.requestFullscreen?.()}
                aria-label="Full screen"
              >
                <Maximize2 className="size-4" />
              </button>
              <button
                className="event-icon-action focus-ring size-12 rounded-xl text-white"
                onClick={shareResult}
                aria-label="Share result"
              >
                <Share2 className="size-4" />
              </button>
            </div>

            {message ? (
              <p
                className={
                  messageTone === "danger"
                    ? "danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold"
                    : "mt-4 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-[#dfe6f6]"
                }
              >
                {message}
              </p>
            ) : null}

            {isPrivateDraw && !canSpinDraw ? (
              <p className="mt-4 text-sm font-semibold text-[#aeb7ca]">
                Operator sign-in is required to run this draw.
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-[#7f8aa3]">
              {settings.publicDisclosureMessage}
            </p>
            <div className="mt-5 sm:mt-8">
              <RecentResults results={recent} />
            </div>
          </div>
        </section>
      </div>

      <SeoSections />
      <PublicFooter />
      <WinnerModal
        result={result}
        onClose={closeResult}
        onShare={shareResult}
      />
    </main>
  );
}

function SeoSections() {
  const sections = [
    [
      "Free Random Draw Tool",
      "RandomSpin gives you a polished random draw experience for quick choices, games, giveaways, classroom picks, and friendly draws.",
    ],
    [
      "How Number Draw Works",
      "Choose a FROM and TO number, press SPIN, and the server determines the result independently of the visual animation.",
    ],
    [
      "Names, Numbers, And More",
      "Use Number Draw for ranges or switch to Player Draw when you want to paste names and pick a participant.",
    ],
    [
      "Live Draws Made Clear",
      "RandomSpin keeps the interface readable for phones, desktops, projectors, and livestream-style presentations.",
    ],
  ];

  return (
    <section className="presentation-secondary mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2 lg:px-8">
      {sections.map(([title, copy]) => (
        <article
          key={title}
          className="event-panel rounded-xl p-6"
        >
          <h2 className="mb-3 font-[var(--font-display)] text-xl font-black text-white">
            {title}
          </h2>
          <p className="leading-7 text-[#aeb7ca]">{copy}</p>
        </article>
      ))}
    </section>
  );
}

function PublicFooter() {
  return (
    <footer className="presentation-footer border-t border-white/10 px-4 py-8 text-sm text-[#aeb7ca] sm:px-6 lg:px-8">
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
