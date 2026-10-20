"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileUp,
  ListRestart,
  Maximize2,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Confetti } from "@/components/public/Confetti";
import {
  PlayerWinnerModal,
  type PlayerWinnerResult,
} from "@/components/public/PlayerWinnerModal";
import { PublicGameNav } from "@/components/public/PublicGameNav";

export type PlayerParticipantView = {
  id: string;
  displayName: string;
  reference: string | null;
  isEligible: boolean;
};

export type LuckyPlayerMode =
  | { kind: "public"; spinEndpoint: "/api/player-spin"; label?: null }
  | {
      kind: "private";
      publicCode: string;
      spinEndpoint: string;
      label: string;
      eventName: string;
      participantCount: number;
      eligibleCount: number;
      removeWinnerAfterWin: boolean;
      showParticipantList: boolean;
      showRecentWinners?: boolean;
      canOperate?: boolean;
      drawId?: string;
      drawMode?: "RANDOM" | "OPERATOR";
      showReferencesPublicly?: boolean;
      revision?: string;
    };

type PlayerSpinResponse = PlayerWinnerResult & {
  eligibleCount: number;
  error?: never;
};

const finishingDelays = [100, 140, 190, 260];
const reducedMotionFinishingDelays = [140, 200, 280];
const winnerHoldMs = 1200;
const countdownSteps = [3, 2, 1];
const countdownReadyMs = 700;
const countdownStepMs = 650;
const clearAllConfirmMs = 3500;

function createLocalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function cleanText(value: string, maxLength = 120) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseLines(text: string): PlayerParticipantView[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 1000)
    .map((displayName) => ({
      id: createLocalId(),
      displayName,
      reference: null,
      isEligible: true,
    }));
}

function parseCsv(text: string): PlayerParticipantView[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) =>
      line.split(",").map((cell) => cleanText(cell.replace(/^"|"$/g, ""), 120)),
    )
    .filter((row) => row.some(Boolean));
  const hasHeader = rows[0]?.[0]?.toLowerCase() === "name";

  return rows
    .slice(hasHeader ? 1 : 0)
    .filter((row) => row[0])
    .slice(0, 1000)
    .map((row) => ({
      id: createLocalId(),
      displayName: row[0],
      reference: row[1] || null,
      isEligible: true,
    }));
}

function countDuplicateNames(participants: PlayerParticipantView[]) {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const participant of participants) {
    const key = participant.displayName.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function removeDuplicateNames(participants: PlayerParticipantView[]) {
  const seen = new Set<string>();
  return participants.filter((participant) => {
    const key = participant.displayName.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getDuplicateOrdinals(participants: PlayerParticipantView[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();

  for (const participant of participants) {
    const key = participant.displayName.toLowerCase();
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return new Map(
    participants.map((participant) => {
      const key = participant.displayName.toLowerCase();
      const next = (seen.get(key) ?? 0) + 1;
      seen.set(key, next);
      return [
        participant.id,
        (totals.get(key) ?? 0) > 1 ? next : null,
      ] as const;
    }),
  );
}

function participantDisplayDetail(
  participant: PlayerParticipantView,
  duplicateOrdinals: Map<string, number | null>,
) {
  if (participant.reference) {
    return participant.reference;
  }

  const duplicateOrdinal = duplicateOrdinals.get(participant.id);
  return duplicateOrdinal ? `#${duplicateOrdinal}` : null;
}

function getParticipantMembershipKey(participants: PlayerParticipantView[]) {
  return participants
    .map((participant) => participant.id)
    .sort()
    .join("|");
}

function getShuffleSessionKey(mode: LuckyPlayerMode) {
  return `randomspin:player-shuffle:${
    mode.kind === "private" ? mode.publicCode : "public"
  }`;
}

function getInitialShuffleCount(
  mode: LuckyPlayerMode,
  participants: PlayerParticipantView[],
) {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const stored = window.sessionStorage.getItem(getShuffleSessionKey(mode));
    if (!stored) {
      return 0;
    }
    const parsed = JSON.parse(stored) as {
      membership?: string;
      count?: number;
    };
    return parsed.membership === getParticipantMembershipKey(participants) &&
      typeof parsed.count === "number" &&
      Number.isInteger(parsed.count)
      ? Math.max(0, parsed.count)
      : 0;
  } catch {
    return 0;
  }
}

export function LuckyPlayerHome({
  mode = { kind: "public", spinEndpoint: "/api/player-spin", label: null },
  initialParticipants = [],
}: {
  mode?: LuckyPlayerMode;
  initialParticipants?: PlayerParticipantView[];
}) {
  const [participants, setParticipants] =
    useState<PlayerParticipantView[]>(initialParticipants);
  const [manualText, setManualText] = useState("");
  const [newName, setNewName] = useState("");
  const [newReference, setNewReference] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showPrivateParticipantEditor, setShowPrivateParticipantEditor] =
    useState(false);
  const [query, setQuery] = useState("");
  const [rollingName, setRollingName] = useState("READY");
  const [phase, setPhase] = useState<
    "READY" | "COUNTDOWN" | "ROLLING" | "WINNING" | "COMPLETE" | "ERROR"
  >("READY");
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [savingPlayers, setSavingPlayers] = useState(false);
  const [participantRevision, setParticipantRevision] = useState(mode.kind === "private" ? mode.revision ?? "" : "");
  const [hasCompletedDraw, setHasCompletedDraw] = useState(false);
  const [result, setResult] = useState<PlayerWinnerResult | null>(null);
  const [recentWinners, setRecentWinners] = useState<PlayerWinnerResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [shuffleCount, setShuffleCount] = useState(() =>
    getInitialShuffleCount(mode, initialParticipants),
  );
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem("lucky-player-sound");
    return stored ? stored === "on" : true;
  });
  const timerRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);
  const clearAllTimerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const spinInFlightRef = useRef(false);
  const cursorRef = useRef(0);
  const normalParticipantOrderRef = useRef(
    initialParticipants.map((participant) => participant.id),
  );
  const previousParticipantMembershipRef = useRef(
    getParticipantMembershipKey(initialParticipants),
  );
  const drawButtonLabel =
    phase === "ERROR"
      ? "TRY AGAIN"
      : hasCompletedDraw
        ? "DRAW AGAIN"
        : "DRAW PLAYER";
  const privateMode = mode.kind === "private";
  const canOperatePrivateDraw = !privateMode || mode.canOperate !== false;
  const showSetupControls =
    (!privateMode || canOperatePrivateDraw) && !liveMode;
  const showLiveControls = (privateMode && canOperatePrivateDraw) || liveMode;
  const showParticipantPreview = privateMode || !liveMode;
  const participantListHiddenFromPresentation =
    privateMode && !mode.showParticipantList;
  const canShowPrivateParticipantEditor =
    participantListHiddenFromPresentation &&
    canOperatePrivateDraw &&
    showSetupControls;
  const showParticipantList =
    !participantListHiddenFromPresentation || showPrivateParticipantEditor;
  const visibleParticipants = participants;
  const participantMembershipKey = getParticipantMembershipKey(participants);
  const shuffleSessionKey = getShuffleSessionKey(mode);
  const eligibleParticipants = visibleParticipants.filter(
    (participant) => participant.isEligible,
  );
  const duplicateCount = countDuplicateNames(visibleParticipants);
  const duplicateOrdinals = useMemo(
    () => getDuplicateOrdinals(visibleParticipants),
    [visibleParticipants],
  );
  const filteredParticipants = visibleParticipants
    .filter((participant) =>
      `${participant.displayName} ${participant.reference ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 120);
  const participantCount =
    privateMode && !canOperatePrivateDraw
      ? mode.participantCount
      : visibleParticipants.length;
  const eligibleCount =
    privateMode && !canOperatePrivateDraw
      ? mode.eligibleCount
      : eligibleParticipants.length;
  const showRecentWinners =
    (mode.kind === "public" || mode.showRecentWinners === true) &&
    (showLiveControls || recentWinners.length > 0);

  useEffect(() => {
    window.localStorage.setItem(
      "lucky-player-sound",
      soundEnabled ? "on" : "off",
    );
  }, [soundEnabled]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        shuffleSessionKey,
        JSON.stringify({
          membership: participantMembershipKey,
          count: shuffleCount,
        }),
      );
    } catch {
      // Session storage is optional presentation state.
    }
  }, [participantMembershipKey, shuffleCount, shuffleSessionKey]);

  useEffect(() => {
    if (previousParticipantMembershipRef.current === participantMembershipKey) {
      return;
    }

    previousParticipantMembershipRef.current = participantMembershipKey;
    normalParticipantOrderRef.current = participants.map(
      (participant) => participant.id,
    );
  }, [participantMembershipKey, participants]);

  useEffect(() => {
    return () => {
      clearTimers();
      void audioRef.current?.close();
    };
  }, []);

  function clearTimers() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (confettiTimerRef.current !== null) {
      window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }

    if (clearAllTimerRef.current !== null) {
      window.clearTimeout(clearAllTimerRef.current);
      clearAllTimerRef.current = null;
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  function playTick(final = false) {
    const audio = getAudioContext();
    if (!audio) {
      return;
    }

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = final ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(final ? 659 : 220, audio.currentTime);
    gain.gain.setValueAtTime(final ? 0.05 : 0.026, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audio.currentTime + (final ? 0.16 : 0.045),
    );
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + (final ? 0.18 : 0.055));
  }

  function playCountdownTick(step: number) {
    const audio = getAudioContext();
    if (!audio) {
      return;
    }

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      step === 1 ? 392 : step === 2 ? 330 : 262,
      now,
    );
    gain.gain.setValueAtTime(
      step === 1 ? 0.045 : step === 2 ? 0.035 : 0.026,
      now,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }

  function waitFor(ms: number) {
    return new Promise<void>((resolve) => {
      timerRef.current = window.setTimeout(resolve, ms);
    });
  }

  function placeholderName() {
    const source =
      privateMode && !mode.showParticipantList
        ? [{ displayName: `PLAYER ${((cursorRef.current += 1) % 9) + 1}`, reference: null }]
        : visibleParticipants.length > 0
        ? visibleParticipants
        : [{ displayName: "PLAYER", reference: null }];
    cursorRef.current = (cursorRef.current + 1) % source.length;
    return source[cursorRef.current]?.displayName ?? "PLAYER";
  }

  function getFinishingNames(winnerName: string, stepCount: number) {
    const candidates = (privateMode && !mode.showParticipantList ? [] : visibleParticipants)
      .map((participant) => participant.displayName)
      .filter(
        (name) => name.trim().toLowerCase() !== winnerName.trim().toLowerCase(),
      );
    const fallbackCandidates = [
      "PLAYER 1",
      "PLAYER 2",
      "PLAYER 3",
      "PLAYER 4",
    ].filter((name) => name.toLowerCase() !== winnerName.trim().toLowerCase());
    const source = candidates.length > 0 ? candidates : fallbackCandidates;
    const names: string[] = [];

    for (let index = 0; index < stepCount; index += 1) {
      const nextName =
        source[(cursorRef.current + index + 1) % source.length] ?? "PLAYER";
      const previousName = names[names.length - 1];
      names.push(
        previousName === nextName && source.length > 1
          ? (source[(cursorRef.current + index + 2) % source.length] ??
              nextName)
          : nextName,
      );
    }

    cursorRef.current += stepCount;
    return names;
  }

  function startRolling() {
    setPhase("ROLLING");
    setCountdownValue(null);
    setRollingName(placeholderName());

    const tick = () => {
      setRollingName(
        privateMode &&
          !mode.showParticipantList &&
          visibleParticipants.length === 0
          ? `PLAYER ${((cursorRef.current += 1) % 9) + 1}`
          : placeholderName(),
      );
      if (!prefersReducedMotion()) {
        playTick(false);
      }
      timerRef.current = window.setTimeout(
        tick,
        prefersReducedMotion() ? 180 : 54,
      );
    };

    timerRef.current = window.setTimeout(
      tick,
      prefersReducedMotion() ? 180 : 54,
    );
  }

  function finishRolling({
    winnerName,
    onWinnerShown,
    onComplete,
  }: {
    winnerName: string;
    onWinnerShown: () => void;
    onComplete: () => void;
  }) {
    clearTimers();
    const delays = prefersReducedMotion()
      ? reducedMotionFinishingDelays
      : finishingDelays;
    const finishingNames = getFinishingNames(winnerName, delays.length);
    let index = 0;

    const tick = () => {
      if (index >= delays.length) {
        setRollingName(winnerName);
        setPhase("WINNING");
        playTick(true);
        onWinnerShown();
        timerRef.current = window.setTimeout(onComplete, winnerHoldMs);
        return;
      }

      setRollingName(finishingNames[index] ?? placeholderName());
      if (!prefersReducedMotion()) {
        playTick(false);
      }
      index += 1;
      timerRef.current = window.setTimeout(
        tick,
        delays[index] ?? delays[delays.length - 1],
      );
    };

    timerRef.current = window.setTimeout(tick, delays[0]);
  }

  async function persistPrivateParticipants(
    nextParticipants: PlayerParticipantView[],
  ) {
    if (!privateMode) {
      setParticipants(nextParticipants);
      return true;
    }

    if (
      !canOperatePrivateDraw ||
      spinning ||
      savingPlayers ||
      !mode.drawId ||
      !mode.drawMode
    ) {
      return false;
    }

    setSavingPlayers(true);
    try {
      const canonicalParticipants = [...nextParticipants].sort((left, right) => {
        const leftIndex = normalParticipantOrderRef.current.indexOf(left.id);
        const rightIndex = normalParticipantOrderRef.current.indexOf(right.id);
        return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
      });
      const response = await fetch(`/api/admin/player-draws/${mode.drawId}/participants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: participantRevision,
          participants: canonicalParticipants.map(({ id, displayName, reference }) => ({ id, displayName, reference }))
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        participants?: PlayerParticipantView[];
        revision?: string | null;
      };

      if (response.status === 409) {
        if (data.participants && data.revision) {
          setParticipants(data.participants);
          setParticipantRevision(data.revision);
          setShuffleCount(0);
        }
        setMessage("Player list changed on another device. Refresh and try again.");
        return false;
      }

      if (!response.ok || !data.participants || !data.revision) {
        setMessage("Unable to update players.");
        return false;
      }

      setParticipants(data.participants);
      setParticipantRevision(data.revision);
      setShuffleCount(0);
      return true;
    } catch {
      setMessage("Unable to update players.");
      return false;
    } finally {
      setSavingPlayers(false);
    }
  }

  async function loadManualNames() {
    try {
      const nextParticipants = parseLines(manualText);
      if (!privateMode) {
        setParticipants(nextParticipants);
        setShuffleCount(0);
        setQuery("");
        setConfirmClearAll(false);
        setMessage(null);
        return;
      }
      const saved = await persistPrivateParticipants(nextParticipants);
      if (saved) {
        setShuffleCount(0);
        setQuery("");
        setConfirmClearAll(false);
        setMessage(null);
      }
    } catch {
      setMessage("Could not read those names.");
    }
  }

  async function importCsv(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 120_000) {
      setMessage("Use a CSV file under 120 KB.");
      return;
    }

    const nextParticipants = parseCsv(await file.text());
    if (!privateMode) {
      setParticipants(nextParticipants);
      setShuffleCount(0);
      setQuery("");
      setConfirmClearAll(false);
      setMessage(null);
      return;
    }
    const saved = await persistPrivateParticipants(nextParticipants);
    if (saved) {
      setShuffleCount(0);
      setQuery("");
      setConfirmClearAll(false);
      setMessage(null);
    }
  }

  async function addParticipant() {
    const displayName = cleanText(newName);
    if (!displayName) {
      return;
    }

    const nextParticipants = [
      ...participants,
      {
        id: createLocalId(),
        displayName,
        reference: cleanText(newReference, 80) || null,
        isEligible: true,
      },
    ];
    if (!privateMode) {
      setParticipants(nextParticipants);
      setShuffleCount(0);
      setNewName("");
      setNewReference("");
      setConfirmClearAll(false);
      return;
    }
    const saved = await persistPrivateParticipants(nextParticipants);
    if (saved) {
      setShuffleCount(0);
      setNewName("");
      setNewReference("");
      setConfirmClearAll(false);
    }
  }

  function shuffleParticipants() {
    if (spinning || participants.length < 2) {
      return;
    }

    setMessage(null);
    setParticipants((current) => {
      const shuffled = [...current];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [
          shuffled[swapIndex],
          shuffled[index],
        ];
      }
      return shuffled;
    });
    setShuffleCount((current) => current + 1);
  }

  function resetShuffleCount() {
    if (spinning) {
      return;
    }

    setShuffleCount(0);
  }

  function resetPlayerShuffleForNextDraw(removedParticipantId?: string) {
    setShuffleCount(0);
    setParticipants((current) => {
      const currentParticipants = removedParticipantId
        ? privateMode
          ? current.map((participant) =>
              participant.id === removedParticipantId
                ? { ...participant, isEligible: false }
                : participant,
            )
          : current.filter(
              (participant) => participant.id !== removedParticipantId,
            )
        : current;
      const participantById = new Map(
        currentParticipants.map((participant) => [participant.id, participant]),
      );
      const restoredOrder = normalParticipantOrderRef.current.map((id) =>
        participantById.get(id),
      );

      if (
        restoredOrder.length !== currentParticipants.length ||
        restoredOrder.some((participant) => !participant)
      ) {
        normalParticipantOrderRef.current = currentParticipants.map(
          (participant) => participant.id,
        );
        return currentParticipants;
      }

      const nextParticipants = restoredOrder as PlayerParticipantView[];
      return nextParticipants.every(
        (participant, index) => participant === currentParticipants[index],
      )
        ? currentParticipants
        : nextParticipants;
    });
  }

  async function clearAllPlayers() {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setMessage(null);
      if (clearAllTimerRef.current !== null) {
        window.clearTimeout(clearAllTimerRef.current);
      }
      clearAllTimerRef.current = window.setTimeout(() => {
        setConfirmClearAll(false);
        clearAllTimerRef.current = null;
      }, clearAllConfirmMs);
      return;
    }

    if (clearAllTimerRef.current !== null) {
      window.clearTimeout(clearAllTimerRef.current);
      clearAllTimerRef.current = null;
    }

    if (!privateMode) {
      setParticipants([]);
      setShuffleCount(0);
      setManualText("");
      setNewName("");
      setNewReference("");
      setShowMoreOptions(false);
      setQuery("");
      setConfirmClearAll(false);
      setMessage(null);
      return;
    }
    const saved = await persistPrivateParticipants([]);
    if (saved) {
      setShuffleCount(0);
      setManualText("");
      setNewName("");
      setNewReference("");
      setShowMoreOptions(false);
      setQuery("");
      setConfirmClearAll(false);
      setMessage(null);
    }
  }

  async function drawPlayer() {
    if (spinning || savingPlayers || spinInFlightRef.current) {
      return;
    }

    if (!canOperatePrivateDraw) {
      setMessage("Operator sign-in is required to run this draw.");
      return;
    }

    const drawParticipants = visibleParticipants;
    if (
      !privateMode &&
      drawParticipants.filter((participant) => participant.isEligible)
        .length === 0
    ) {
      setMessage("Add at least one eligible participant.");
      return;
    }

    setSpinning(true);
    spinInFlightRef.current = true;
    setMessage(null);
    setResult(null);
    setConfetti(false);
    setCountdownValue(null);
    clearTimers();
    void getAudioContext();

    try {
      setPhase("COUNTDOWN");
      const responsePromise = fetch(mode.spinEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          privateMode
            ? { winner: "ignored" }
            : { participants: drawParticipants, winner: "ignored" },
        ),
      });

      setCountdownValue(null);
      playCountdownTick(3);
      await waitFor(countdownReadyMs);

      for (const step of countdownSteps) {
        setCountdownValue(step);
        playCountdownTick(step);
        await waitFor(countdownStepMs);
      }

      const rollingStartedAt = performance.now();
      startRolling();
      const response = await responsePromise;
      const data = (await response.json()) as
        PlayerSpinResponse | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Draw failed.");
      }

      const wait = Math.max(0, 700 - (performance.now() - rollingStartedAt));
      timerRef.current = window.setTimeout(() => {
        const nextResult = {
          spinId: data.spinId,
          participantId: data.participantId,
          displayName: data.displayName,
          reference:
            privateMode && !mode.showReferencesPublicly
              ? null
              : data.reference,
          timestamp: data.timestamp,
        };

        finishRolling({
          winnerName: data.displayName,
          onWinnerShown: () => {
            if (!prefersReducedMotion()) {
              setConfetti(true);
              confettiTimerRef.current = window.setTimeout(
                () => setConfetti(false),
                2200,
              );
            }
          },
          onComplete: () => {
            setSpinning(false);
            spinInFlightRef.current = false;
            setHasCompletedDraw(true);
            setPhase("COMPLETE");
            setResult(nextResult);
            setRecentWinners((current) => [nextResult, ...current].slice(0, 8));
            resetPlayerShuffleForNextDraw(
              privateMode && mode.removeWinnerAfterWin
                ? (data.participantId ?? undefined)
                : undefined,
            );
          },
        });
      }, wait);
    } catch {
      clearTimers();
      setSpinning(false);
      spinInFlightRef.current = false;
      setPhase("ERROR");
      setCountdownValue(null);
      setRollingName("READY");
      setMessage("Unable to draw player");
    }
  }

  function startLiveDraw() {
    if (spinning || savingPlayers || spinInFlightRef.current) {
      return;
    }

    if (eligibleCount === 0) {
      setMessage("Add at least one eligible participant.");
      return;
    }

    setLiveMode(true);
    void drawPlayer();
  }

  async function shareResult() {
    if (!result) {
      return;
    }

    const text = `RandomSpin picked ${result.displayName}!`;
    if (navigator.share) {
      await navigator.share({
        title: "RandomSpin Player Draw",
        text,
        url: window.location.origin,
      });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    setMessage("Result copied.");
  }

  const statusCopy = useMemo(() => {
    if (privateMode && mode.removeWinnerAfterWin) {
      return "Previous winners are removed from subsequent draws.";
    }

    return "Shuffle changes the displayed order only.";
  }, [mode, privateMode]);

  return (
    <main className="premium-shell min-h-screen">
      <Confetti active={confetti} />
      <div className="player-draw-frame mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="presentation-chrome flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          {!privateMode ? <PublicGameNav active="players" /> : null}
        </header>

        <section className="player-draw-hero grid min-w-0 flex-1 items-center gap-6 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:py-12">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f6d98f]">
                RandomSpin Player Draw
              </p>
              {privateMode ? (
                <span className="event-status-pill rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#dfe6f6]">
                  {mode.label}
                </span>
              ) : null}
            </div>
            <h1 className="font-[var(--font-display)] text-4xl font-black uppercase leading-none text-white sm:text-6xl">
              {privateMode ? mode.eventName : "Player Draw"}
            </h1>
            <motion.div
              key={`${participantCount}-${eligibleCount}`}
              initial={false}
              animate={{ scale: 1 }}
              className="event-panel mt-5 w-fit rounded-xl px-5 py-4"
            >
              <p className="gold-text font-[var(--font-display)] text-3xl font-black uppercase leading-none sm:text-5xl">
                {participantCount} PLAYERS READY
              </p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-[#aeb7ca]">
                {eligibleCount} Eligible
              </p>
            </motion.div>
            <p className="mt-3 text-xs leading-5 text-[#7f8aa3]">
              {statusCopy}
            </p>

            {showSetupControls ? (
              <div className="mt-6 grid gap-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">
                  Player Setup
                </p>
                <label>
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">
                    Paste Names
                  </span>
                  <textarea
                    className="focus-ring min-h-36 w-full resize-y rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
                    value={manualText}
                    onChange={(event) => setManualText(event.target.value)}
                    placeholder="Paste one player per line"
                    disabled={spinning || savingPlayers}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="gold-button focus-ring min-h-12 rounded-xl px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60"
                    type="button"
                    onClick={() => void loadManualNames()}
                    disabled={spinning || savingPlayers}
                  >
                    USE NAMES
                  </button>
                  <button
                    className="focus-ring flex min-h-12 items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60"
                    type="button"
                    disabled={spinning || savingPlayers || participants.length < 2}
                    onClick={shuffleParticipants}
                    aria-label={`Shuffle participants, count ${shuffleCount}`}
                  >
                    <Shuffle className="size-4 text-[#f6d98f]" />
                    SHUFFLE {shuffleCount}×
                  </button>
                  <button
                    className="focus-ring min-h-12 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-white/12 disabled:opacity-60"
                    type="button"
                    disabled={spinning || savingPlayers || shuffleCount === 0}
                    onClick={resetShuffleCount}
                    aria-label="Reset shuffle count"
                  >
                    RESET COUNT
                  </button>
                  <button
                    className="focus-ring rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60"
                    type="button"
                    disabled={
                      spinning ||
                      savingPlayers ||
                      (participants.length === 0 &&
                        !manualText.trim() &&
                        !newName.trim() &&
                        !newReference.trim() &&
                        !query.trim())
                    }
                    onClick={() => void clearAllPlayers()}
                  >
                    {confirmClearAll ? "CONFIRM CLEAR" : "CLEAR LIST"}
                  </button>
                </div>
                {duplicateCount > 0 ? (
                  <div className="rounded-lg border border-[rgba(246,217,143,0.22)] bg-[rgba(246,217,143,0.08)] px-4 py-3 text-sm text-[#fff4d2]">
                    <p className="font-black">
                      {duplicateCount} duplicate names detected
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="focus-ring rounded-lg bg-white/10 px-3 py-2 font-bold text-white"
                        type="button"
                        onClick={() => setMessage(null)}
                      >
                        Keep duplicates
                      </button>
                      <button
                        className="focus-ring rounded-lg bg-white/10 px-3 py-2 font-bold text-white"
                        type="button"
                        disabled={spinning || savingPlayers}
                        onClick={() => {
                          const nextParticipants =
                            removeDuplicateNames(visibleParticipants);
                          if (!privateMode) {
                            setParticipants(nextParticipants);
                            setShuffleCount(0);
                            return;
                          }
                          void persistPrivateParticipants(nextParticipants);
                        }}
                      >
                        Remove duplicates
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showSetupControls ? (
              <div className="mt-6 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    className="focus-ring h-12 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Add player name"
                    disabled={spinning || savingPlayers}
                  />
                  <button
                    className="focus-ring grid h-12 min-w-12 place-items-center rounded-lg border border-white/12 bg-white/8 px-4 text-white hover:bg-white/12 disabled:opacity-50"
                    type="button"
                    onClick={() => void addParticipant()}
                    disabled={spinning || savingPlayers}
                    aria-label="Add participant"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {showMoreOptions ? (
                  <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[minmax(0,0.8fr)_auto] sm:items-center">
                    <input
                      className="focus-ring h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm text-white"
                      value={newReference}
                      onChange={(event) => setNewReference(event.target.value)}
                      placeholder="Reference (optional)"
                      disabled={spinning || savingPlayers}
                    />
                    <label
                      className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-2 text-sm font-black text-white hover:bg-white/12 ${spinning ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    >
                      <FileUp className="size-4 text-[#f6d98f]" />
                      Import CSV
                      <input
                        className="sr-only"
                        type="file"
                        accept=".csv,text/csv"
                        disabled={spinning || savingPlayers}
                        onChange={(event) =>
                          void importCsv(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <button
                    className="focus-ring w-fit rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#aeb7ca] hover:bg-white/[0.08] hover:text-white"
                    type="button"
                    disabled={spinning || savingPlayers}
                    onClick={() => setShowMoreOptions(true)}
                  >
                    MORE OPTIONS
                  </button>
                )}
              </div>
            ) : null}

            {showSetupControls ? (
              <div className="mt-5">
                <button
                  className="gold-button focus-ring min-h-12 rounded-xl px-6 py-4 text-sm uppercase tracking-[0.16em] disabled:opacity-60"
                  type="button"
                  disabled={spinning || savingPlayers || eligibleCount === 0}
                  onClick={startLiveDraw}
                >
                  LIVE DRAW
                </button>
              </div>
            ) : null}

            {showLiveControls ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="gold-button focus-ring min-h-12 rounded-xl px-7 py-4 text-sm uppercase tracking-[0.18em] disabled:opacity-60"
                  type="button"
                  disabled={spinning || savingPlayers || eligibleCount === 0}
                  onClick={drawPlayer}
                >
                  {spinning ? "DRAWING" : drawButtonLabel}
                </button>
                <button
                  className="event-action focus-ring flex min-h-12 items-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  type="button"
                  disabled={spinning || savingPlayers || participants.length < 2}
                  onClick={shuffleParticipants}
                  aria-label={`Shuffle participants, count ${shuffleCount}`}
                >
                  <Shuffle className="size-4 text-[#f6d98f]" />
                  SHUFFLE {shuffleCount}×
                </button>
                <button
                  className="event-action focus-ring min-h-12 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                  type="button"
                  disabled={spinning || savingPlayers || shuffleCount === 0}
                  onClick={resetShuffleCount}
                  aria-label="Reset shuffle count"
                >
                  RESET COUNT
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
                {!privateMode ? (
                  <button
                    className="event-action focus-ring min-h-12 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                    type="button"
                    disabled={spinning}
                    onClick={() => setLiveMode(false)}
                  >
                    EDIT PLAYERS
                  </button>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-[#dfe6f6]">
                {message}
              </p>
            ) : null}

            {showRecentWinners ? (
              <section className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">
                  Recent Winners
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentWinners.length === 0 ? (
                    <p className="text-sm text-[#8f9bb4]">
                      Completed winners will appear here.
                    </p>
                  ) : (
                    recentWinners.map((winner) => (
                      <span
                        key={winner.spinId}
                        className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white"
                      >
                        {winner.displayName}
                        {winner.reference ? (
                          <span className="ml-2 text-[#8f9bb4]">
                            {winner.reference}
                          </span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </section>
            ) : null}
          </div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            className="relative min-w-0"
          >
            <div
              className="absolute inset-8 rounded-full bg-[rgba(246,217,143,0.12)] blur-3xl"
              aria-hidden="true"
            />
            <div className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(246,217,143,0.14),rgba(255,255,255,0.04)_42%,rgba(255,255,255,0.02)_72%)] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:min-h-[30rem]">
              <div
                className={
                  phase === "WINNING" || phase === "COMPLETE"
                    ? "rounded-full border border-[rgba(246,217,143,0.35)] px-6 py-8 shadow-[0_0_80px_rgba(246,217,143,0.18)]"
                    : undefined
                }
              >
                <p className="mb-5 text-xs font-black uppercase tracking-[0.26em] text-[#f6d98f]">
                  {phase === "WINNING" || phase === "COMPLETE"
                    ? "WINNING PLAYER"
                    : phase === "COUNTDOWN"
                      ? "PLAYER DRAW"
                      : "Name Roller"}
                </p>
                {phase === "COUNTDOWN" ? (
                  <motion.div
                    key={countdownValue ?? "countdown"}
                    initial={
                      prefersReducedMotion()
                        ? false
                        : { opacity: 0, scale: 0.82 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    className="gold-text mx-auto flex min-h-[7rem] items-center justify-center font-[var(--font-display)] text-8xl font-black leading-none sm:min-h-[10rem] sm:text-9xl"
                    aria-hidden="true"
                  >
                    {countdownValue ?? "READY"}
                  </motion.div>
                ) : (
                  <div
                    className="mx-auto flex min-h-[7rem] max-w-[min(42rem,calc(100vw-3rem))] items-center justify-center break-words px-2 font-[var(--font-display)] text-4xl font-black uppercase leading-tight text-white sm:min-h-[10rem] sm:text-7xl lg:text-8xl"
                    aria-hidden={phase === "ROLLING"}
                  >
                    {rollingName}
                  </div>
                )}
                <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-[#8f9bb4]">
                  {phase === "READY"
                    ? "READY"
                    : phase === "COUNTDOWN"
                      ? countdownValue === null
                        ? "READY"
                        : "COUNTDOWN"
                      : phase === "ROLLING"
                        ? "ROLLING..."
                        : phase === "ERROR"
                          ? "ERROR"
                          : "WINNING PLAYER"}
                </p>
                {phase === "WINNING" || phase === "COMPLETE" ? (
                  <p className="sr-only" aria-live="polite">
                    Winning player {rollingName}
                  </p>
                ) : null}
              </div>
            </div>

            {showParticipantPreview ? (
              <section className="event-panel mt-5 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-white">
                    {participantCount} Players
                  </p>
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f9bb4]" />
                    <input
                      className="focus-ring h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-9 pr-3 text-sm text-white sm:w-56"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search"
                    />
                  </label>
                </div>
                {participantListHiddenFromPresentation ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[#aeb7ca]">
                      Participant list is hidden for this event.
                    </p>
                    {canShowPrivateParticipantEditor ? (
                      <button
                        className="focus-ring rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#aeb7ca] hover:bg-white/[0.08] hover:text-white"
                        type="button"
                        onClick={() =>
                          setShowPrivateParticipantEditor((value) => !value)
                        }
                      >
                        {showPrivateParticipantEditor
                          ? "HIDE PRIVATE EDITOR"
                          : "OPEN PRIVATE EDITOR"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {showParticipantList ? (
                  <div className="mt-4 grid max-h-72 gap-2 overflow-auto pr-1">
                    {filteredParticipants.length === 0 ? (
                      <p className="text-sm text-[#aeb7ca]">
                        Paste names, import a CSV, or add players manually.
                      </p>
                    ) : (
                      filteredParticipants.map((participant) => {
                        const presentationParticipant = privateMode &&
                          !mode.showReferencesPublicly &&
                          !showPrivateParticipantEditor
                          ? { ...participant, reference: null }
                          : participant;
                        const detail = participantDisplayDetail(
                          presentationParticipant,
                          duplicateOrdinals,
                        );

                        return (
                          <div
                            key={participant.id}
                            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">
                                {participant.displayName}
                                {detail ? (
                                  <span className="ml-2 text-xs font-black text-[#8f9bb4]">
                                    · {detail}
                                  </span>
                                ) : null}
                              </p>
                              {presentationParticipant.reference ? (
                                <p className="text-xs text-[#8f9bb4]">
                                  Reference: {presentationParticipant.reference}
                                </p>
                              ) : null}
                            </div>
                            {showSetupControls ? (
                              <button
                                className="focus-ring grid size-9 place-items-center rounded-lg border border-white/10 text-[#aeb7ca] hover:text-white"
                                type="button"
                                disabled={spinning || savingPlayers}
                                onClick={() => {
                                  const nextParticipants = participants.filter(
                                    (item) => item.id !== participant.id,
                                  );
                                  if (!privateMode) {
                                    setParticipants(nextParticipants);
                                    setShuffleCount(0);
                                    return;
                                  }
                                  void persistPrivateParticipants(
                                    nextParticipants,
                                  );
                                }}
                                aria-label={`Remove ${participant.displayName}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            ) : (
                              <ListRestart
                                className="size-4 text-[#8f9bb4]"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}
          </motion.div>
        </section>
      </div>
      <PlayerFooter />
      <PlayerWinnerModal
        result={result}
        onClose={() => setResult(null)}
        onShare={shareResult}
      />
    </main>
  );
}

function PlayerFooter() {
  return (
    <footer className="presentation-footer border-t border-white/10 px-4 py-8 text-sm text-[#aeb7ca] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark compact />
        <p>Spin names, pick numbers, and run simple random draws.</p>
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
