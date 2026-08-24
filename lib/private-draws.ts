import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeExcludedNumbers, serializeExcludedNumbers } from "@/lib/excluded-numbers";
import { normalizePrivateDrawDisplayStyle, type PrivateDrawDisplayStyle } from "@/lib/private-draw-display";
import { buildEligiblePool, parseExcludedNumbers, selectSecureWinner, SpinValidationError } from "@/lib/spin";

export const PRIVATE_DRAW_RANDOM_MODE = "RANDOM";
export const PRIVATE_DRAW_OPERATOR_MODE = "OPERATOR";
export const PRIVATE_DRAW_MAXIMUM_RANGE = 1000;

export type PrivateDrawMode = typeof PRIVATE_DRAW_RANDOM_MODE | typeof PRIVATE_DRAW_OPERATOR_MODE;

export type PrivateDrawRecord = {
  id: string;
  publicCode: string;
  liveSlug: string | null;
  name: string;
  minNumber: number;
  maxNumber: number;
  excludedNumbers: unknown;
  mode: string;
  displayStyle?: string | null;
  pendingOperatorWinner: number | null;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NormalizedPrivateDraw = Omit<PrivateDrawRecord, "excludedNumbers" | "mode" | "displayStyle"> & {
  excludedNumbers: number[];
  mode: PrivateDrawMode;
  displayStyle: PrivateDrawDisplayStyle;
};

export type PrivateDrawListItem = NormalizedPrivateDraw & {
  completedSpins: number;
};

export type PrivateDrawMutationInput = {
  name: string;
  liveSlug?: string | null;
  minNumber: number;
  maxNumber: number;
  excludedNumbers?: number[];
  excludedText?: string;
  mode: PrivateDrawMode;
  displayStyle?: PrivateDrawDisplayStyle;
  isActive: boolean;
  nextWinner?: number | null;
  clearPendingWinner?: boolean;
  allowExcludedOutsideRange?: boolean;
};

export class PrivateDrawNotFoundError extends Error {
  constructor() {
    super("Private draw not found.");
    this.name = "PrivateDrawNotFoundError";
  }
}

export class PrivateDrawStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateDrawStateError";
  }
}

export class PrivateDrawRangeConflictError extends Error {
  currentState: PrivateDrawAudienceState | null;

  constructor(currentState: PrivateDrawAudienceState | null) {
    super("Live draw range changed. Please review the current range and try again.");
    this.name = "PrivateDrawRangeConflictError";
    this.currentState = currentState;
  }
}

export class PrivateDrawSlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateDrawSlugError";
  }
}

const publicCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const publicCodeLength = 8;
const reservedLiveSlugs = new Set(["admin", "api", "faq", "about", "players", "draw", "live", "privacy", "terms"]);

export type PrivateDrawAudienceState = {
  id: string;
  publicCode: string;
  liveSlug: string | null;
  name: string;
  minNumber: number;
  maxNumber: number;
  mode: PrivateDrawMode;
  displayStyle: PrivateDrawDisplayStyle;
  label: string;
  revision: string;
};

export function isPrivateDrawMode(value: unknown): value is PrivateDrawMode {
  return value === PRIVATE_DRAW_RANDOM_MODE || value === PRIVATE_DRAW_OPERATOR_MODE;
}

export function normalizePrivateDraw(draw: PrivateDrawRecord): NormalizedPrivateDraw {
  return {
    ...draw,
    excludedNumbers: normalizeExcludedNumbers(draw.excludedNumbers),
    mode: draw.mode === PRIVATE_DRAW_OPERATOR_MODE ? PRIVATE_DRAW_OPERATOR_MODE : PRIVATE_DRAW_RANDOM_MODE,
    displayStyle: normalizePrivateDrawDisplayStyle(draw.displayStyle)
  };
}

export function generatePrivateDrawPublicCode() {
  let code = "";

  for (let index = 0; index < publicCodeLength; index += 1) {
    code += publicCodeAlphabet[randomInt(publicCodeAlphabet.length)];
  }

  return code;
}

export function normalizeLiveSlug(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return null;
  }

  if (raw.length < 3 || raw.length > 40) {
    throw new PrivateDrawSlugError("Live URL must be 3 to 40 characters.");
  }

  if (!/^[a-z0-9-]+$/.test(raw)) {
    throw new PrivateDrawSlugError("Live URL can use lowercase letters, numbers, and hyphens only.");
  }

  if (raw.startsWith("-") || raw.endsWith("-") || raw.includes("--")) {
    throw new PrivateDrawSlugError("Live URL cannot start or end with a hyphen or contain repeated hyphens.");
  }

  if (reservedLiveSlugs.has(raw)) {
    throw new PrivateDrawSlugError("Use a different live URL. That word is reserved.");
  }

  return raw;
}

export function getPrivateDrawLivePath(draw: { publicCode: string; liveSlug?: string | null }) {
  return `/live/${draw.liveSlug ?? draw.publicCode}`;
}

export function getPrivateDrawAudienceLabel(mode: string, pendingOperatorWinner?: number | null) {
  return mode === PRIVATE_DRAW_OPERATOR_MODE && pendingOperatorWinner !== null && pendingOperatorWinner !== undefined ? "OPERATOR DRAW" : "RANDOM DRAW";
}

export function validateOperatorWinner(draw: NormalizedPrivateDraw, winner: unknown) {
  if (!Number.isInteger(winner)) {
    throw new SpinValidationError("Next winner must be a whole number.");
  }

  const eligiblePool = buildEligiblePool(draw.minNumber, draw.maxNumber, {
    configMin: draw.minNumber,
    configMax: draw.maxNumber,
    excludedNumbers: draw.excludedNumbers,
    maximumAllowedRange: PRIVATE_DRAW_MAXIMUM_RANGE
  });

  if (!eligiblePool.includes(winner as number)) {
    throw new SpinValidationError("Next winner must be inside the draw range and eligible.");
  }

  return {
    winner: winner as number,
    eligiblePool
  };
}

function validateDrawRange(minNumber: number, maxNumber: number) {
  if (!Number.isInteger(minNumber) || !Number.isInteger(maxNumber)) {
    throw new SpinValidationError("Draw range must use whole numbers.");
  }

  if (minNumber >= maxNumber) {
    throw new SpinValidationError("FROM must be lower than TO.");
  }

  if (maxNumber - minNumber + 1 > PRIVATE_DRAW_MAXIMUM_RANGE) {
    throw new SpinValidationError("Private draw range can include at most 1,000 numbers.");
  }
}

function validateLiveDrawRange(minNumber: number, maxNumber: number) {
  validateDrawRange(minNumber, maxNumber);

  if (minNumber < 0 || maxNumber < 0) {
    throw new SpinValidationError("Live draw range cannot use negative numbers.");
  }
}

function parseUnboundedExcludedNumbers(input: string) {
  if (!input.trim()) {
    return [];
  }

  const parts = input.split(",").filter(Boolean);
  const values = parts.map((value) => Number(value.trim())).filter((value) => Number.isFinite(value));

  if (values.length !== parts.length || values.some((value) => !Number.isInteger(value))) {
    throw new SpinValidationError("Use comma-separated whole numbers only.");
  }

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function getExcludedNumbers(input: PrivateDrawMutationInput, range: { minNumber: number; maxNumber: number }) {
  const excludedNumbers =
    input.excludedText !== undefined
      ? input.allowExcludedOutsideRange
        ? parseUnboundedExcludedNumbers(input.excludedText)
        : parseExcludedNumbers(input.excludedText, range.minNumber, range.maxNumber)
      : Array.from(new Set(input.excludedNumbers ?? [])).sort((a, b) => a - b);

  if (!input.allowExcludedOutsideRange && excludedNumbers.some((value) => !Number.isInteger(value) || value < range.minNumber || value > range.maxNumber)) {
    const invalid = excludedNumbers.filter((value) => !Number.isInteger(value) || value < range.minNumber || value > range.maxNumber);
    throw new SpinValidationError(`Excluded numbers outside the new range: ${invalid.join(", ")}`);
  }

  return excludedNumbers;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isLiveSlugUniqueConstraintError(error: unknown) {
  const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : null;

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    ((Array.isArray(target) && target.includes("liveSlug")) || (typeof target === "string" && target.includes("liveSlug")))
  );
}

function isValidPendingWinner(draw: NormalizedPrivateDraw, winner: number | null) {
  if (winner === null) {
    return true;
  }

  try {
    validateOperatorWinner(draw, winner);
    return true;
  } catch {
    return false;
  }
}

function toPrivateDrawAudienceState(draw: NormalizedPrivateDraw, pendingOperatorWinner = draw.pendingOperatorWinner): PrivateDrawAudienceState {
  return {
    id: draw.id,
    publicCode: draw.publicCode,
    liveSlug: draw.liveSlug,
    name: draw.name,
    minNumber: draw.minNumber,
    maxNumber: draw.maxNumber,
    mode: draw.mode,
    displayStyle: draw.displayStyle,
    label: getPrivateDrawAudienceLabel(draw.mode, pendingOperatorWinner),
    revision: draw.updatedAt.toISOString()
  };
}

async function assertLiveSlugAvailable(liveSlug: string | null, currentDrawId?: string) {
  if (!liveSlug) {
    return;
  }

  const existing = await prisma.privateDraw.findFirst({
    where: {
      OR: [{ liveSlug }, { publicCode: liveSlug.toUpperCase() }],
      ...(currentDrawId ? { NOT: { id: currentDrawId } } : {})
    },
    select: { id: true }
  });

  if (existing) {
    throw new PrivateDrawSlugError("That live URL is already in use.");
  }
}

export async function listPrivateDraws(): Promise<PrivateDrawListItem[]> {
  const draws = await prisma.privateDraw.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { spinResults: true } } }
  });

  return draws.map((draw) => ({
    ...normalizePrivateDraw(draw),
    completedSpins: draw._count.spinResults
  }));
}

export async function getPrivateDrawAudience(publicCode: string) {
  const lookup = String(publicCode).trim();
  const draw = await prisma.privateDraw.findFirst({
    where: {
      OR: [{ publicCode: lookup.toUpperCase() }, { liveSlug: lookup.toLowerCase() }]
    }
  });

  if (!draw || !draw.isActive || draw.archivedAt) {
    return null;
  }

  const normalized = normalizePrivateDraw(draw);
  let pendingOperatorWinner = normalized.pendingOperatorWinner;

  if (normalized.mode === PRIVATE_DRAW_OPERATOR_MODE && pendingOperatorWinner !== null && !isValidPendingWinner(normalized, pendingOperatorWinner)) {
    await prisma.privateDraw.updateMany({
      where: { id: normalized.id, pendingOperatorWinner },
      data: { pendingOperatorWinner: null }
    });
    pendingOperatorWinner = null;
  }

  return toPrivateDrawAudienceState(normalized, pendingOperatorWinner);
}

export async function updatePrivateDrawLiveRange({
  publicCode,
  minNumber,
  maxNumber,
  revision
}: {
  publicCode: string;
  minNumber: number;
  maxNumber: number;
  revision: string;
}) {
  validateLiveDrawRange(minNumber, maxNumber);

  const lookup = String(publicCode).trim();
  const draw = await prisma.privateDraw.findFirst({
    where: {
      OR: [{ publicCode: lookup.toUpperCase() }, { liveSlug: lookup.toLowerCase() }]
    }
  });

  if (!draw || !draw.isActive || draw.archivedAt) {
    throw new PrivateDrawNotFoundError();
  }

  const expectedRevision = new Date(revision);
  if (Number.isNaN(expectedRevision.getTime())) {
    throw new SpinValidationError("Live draw range is out of date. Refresh and try again.");
  }

  const nextDraw = normalizePrivateDraw({
    ...draw,
    minNumber,
    maxNumber
  });
  const pendingOperatorWinner = isValidPendingWinner(nextDraw, nextDraw.pendingOperatorWinner) ? nextDraw.pendingOperatorWinner : null;
  const updatedAt = new Date();
  const updated = await prisma.privateDraw.updateMany({
    where: {
      id: draw.id,
      isActive: true,
      archivedAt: null,
      updatedAt: expectedRevision
    },
    data: {
      minNumber,
      maxNumber,
      pendingOperatorWinner,
      updatedAt
    }
  });

  if (updated.count !== 1) {
    const current = await prisma.privateDraw.findUnique({ where: { id: draw.id } });
    throw new PrivateDrawRangeConflictError(current && current.isActive && !current.archivedAt ? toPrivateDrawAudienceState(normalizePrivateDraw(current)) : null);
  }

  return toPrivateDrawAudienceState(
    normalizePrivateDraw({
      ...draw,
      minNumber,
      maxNumber,
      pendingOperatorWinner,
      updatedAt
    })
  );
}

export async function getPrivateDrawForAdmin(id: string) {
  const draw = await prisma.privateDraw.findUnique({
    where: { id },
    include: {
      spinResults: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!draw) {
    return null;
  }

  const normalized = normalizePrivateDraw(draw);

  return {
    ...normalized,
    spinResults: draw.spinResults
  };
}

export async function createPrivateDraw(input: PrivateDrawMutationInput) {
  validateDrawRange(input.minNumber, input.maxNumber);

  if (!isPrivateDrawMode(input.mode)) {
    throw new SpinValidationError("Use a valid draw mode.");
  }

  const excludedNumbers = getExcludedNumbers(input, { minNumber: input.minNumber, maxNumber: input.maxNumber });
  const liveSlug = normalizeLiveSlug(input.liveSlug);
  await assertLiveSlugAvailable(liveSlug);
  const displayStyle = normalizePrivateDrawDisplayStyle(input.displayStyle);
  const provisionalDraw = normalizePrivateDraw({
    id: "new",
    publicCode: "PENDING",
    name: input.name,
    liveSlug,
    minNumber: input.minNumber,
    maxNumber: input.maxNumber,
    excludedNumbers,
    mode: input.mode,
    displayStyle,
    pendingOperatorWinner: null,
    isActive: input.isActive,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  const pendingOperatorWinner =
    input.mode === PRIVATE_DRAW_OPERATOR_MODE && input.nextWinner !== undefined && input.nextWinner !== null
      ? validateOperatorWinner(provisionalDraw, input.nextWinner).winner
      : null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const created = await prisma.privateDraw.create({
        data: {
          publicCode: generatePrivateDrawPublicCode(),
          liveSlug,
          name: input.name,
          minNumber: input.minNumber,
          maxNumber: input.maxNumber,
          excludedNumbers: serializeExcludedNumbers(excludedNumbers),
          mode: input.mode,
          displayStyle,
          isActive: input.isActive,
          archivedAt: null,
          pendingOperatorWinner
        }
      });

      return normalizePrivateDraw(created);
    } catch (error) {
      if (isLiveSlugUniqueConstraintError(error)) {
        throw new PrivateDrawSlugError("That live URL is already in use.");
      }

      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Could not generate a unique public code.");
}

export async function updatePrivateDraw({
  id,
  input
}: {
  id: string;
  input: PrivateDrawMutationInput;
}) {
  const draw = await prisma.privateDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PrivateDrawNotFoundError();
  }

  const liveRangeLocked = draw.isActive;
  const nextMinNumber = liveRangeLocked ? draw.minNumber : input.minNumber;
  const nextMaxNumber = liveRangeLocked ? draw.maxNumber : input.maxNumber;

  validateDrawRange(nextMinNumber, nextMaxNumber);

  if (!isPrivateDrawMode(input.mode)) {
    throw new SpinValidationError("Use a valid draw mode.");
  }

  const excludedNumbers = getExcludedNumbers(
    {
      ...input,
      minNumber: nextMinNumber,
      maxNumber: nextMaxNumber,
      allowExcludedOutsideRange: liveRangeLocked || input.allowExcludedOutsideRange
    },
    { minNumber: nextMinNumber, maxNumber: nextMaxNumber }
  );
  const liveSlug = normalizeLiveSlug(input.liveSlug);
  await assertLiveSlugAvailable(liveSlug, id);
  const displayStyle = normalizePrivateDrawDisplayStyle(input.displayStyle ?? draw.displayStyle);
  const nextDraw = normalizePrivateDraw({
    ...draw,
    name: input.name,
    liveSlug,
    minNumber: nextMinNumber,
    maxNumber: nextMaxNumber,
    excludedNumbers,
    mode: input.mode,
    displayStyle,
    isActive: input.isActive
  });
  let pendingOperatorWinner: number | null = draw.pendingOperatorWinner;
  let pendingWinnerCleared = false;

  if (input.mode === PRIVATE_DRAW_RANDOM_MODE) {
    pendingWinnerCleared = pendingOperatorWinner !== null;
    pendingOperatorWinner = null;
  } else if (input.clearPendingWinner || input.nextWinner === null) {
    pendingWinnerCleared = pendingOperatorWinner !== null;
    pendingOperatorWinner = null;
  } else if (input.nextWinner !== undefined) {
    pendingOperatorWinner = validateOperatorWinner(nextDraw, input.nextWinner).winner;
  } else if (!isValidPendingWinner(nextDraw, pendingOperatorWinner)) {
    pendingOperatorWinner = null;
    pendingWinnerCleared = true;
  }

  const updated = await prisma.privateDraw.update({
    where: { id },
    data: {
      name: input.name,
      liveSlug,
      minNumber: nextMinNumber,
      maxNumber: nextMaxNumber,
      excludedNumbers: serializeExcludedNumbers(excludedNumbers),
      mode: input.mode,
      displayStyle,
      isActive: input.isActive,
      pendingOperatorWinner
    }
  });

  return {
    draw: normalizePrivateDraw(updated),
    pendingWinnerCleared
  };
}

export async function createPrivateDrawSpin({
  publicCode,
  hashedIp,
  userAgent
}: {
  publicCode: string;
  hashedIp?: string;
  userAgent?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const lookup = String(publicCode).trim();
    const draw = await tx.privateDraw.findFirst({
      where: {
        OR: [{ publicCode: lookup.toUpperCase() }, { liveSlug: lookup.toLowerCase() }]
      }
    });

    if (!draw || !draw.isActive || draw.archivedAt) {
      throw new PrivateDrawNotFoundError();
    }

    const normalized = normalizePrivateDraw(draw);
    let winner: number;
    let eligiblePool: number[];
    let resultMode: PrivateDrawMode = PRIVATE_DRAW_RANDOM_MODE;
    const requestedMin = normalized.minNumber;
    const requestedMax = normalized.maxNumber;
    const selectRandomFallback = () =>
      selectSecureWinner(normalized.minNumber, normalized.maxNumber, {
        configMin: normalized.minNumber,
        configMax: normalized.maxNumber,
        excludedNumbers: normalized.excludedNumbers,
        maximumAllowedRange: PRIVATE_DRAW_MAXIMUM_RANGE
      });

    if (normalized.mode === PRIVATE_DRAW_OPERATOR_MODE && normalized.pendingOperatorWinner !== null) {
      try {
        const operatorSelection = validateOperatorWinner(normalized, normalized.pendingOperatorWinner);
        winner = operatorSelection.winner;
        eligiblePool = operatorSelection.eligiblePool;
        resultMode = PRIVATE_DRAW_OPERATOR_MODE;
      } catch (error) {
        if (!(error instanceof SpinValidationError)) {
          throw error;
        }

        await tx.privateDraw.updateMany({
          where: {
            id: normalized.id,
            pendingOperatorWinner: normalized.pendingOperatorWinner
          },
          data: {
            pendingOperatorWinner: null
          }
        });

        const randomSelection = selectRandomFallback();
        winner = randomSelection.winner;
        eligiblePool = randomSelection.eligiblePool;
        resultMode = PRIVATE_DRAW_RANDOM_MODE;
      }

      if (resultMode === PRIVATE_DRAW_OPERATOR_MODE) {
        const consumed = await tx.privateDraw.updateMany({
          where: {
            id: normalized.id,
            pendingOperatorWinner: winner
          },
          data: {
            pendingOperatorWinner: null
          }
        });

        if (consumed.count !== 1) {
          throw new SpinValidationError("This draw is already processing the confirmed winner. Please try again.");
        }
      }
    } else {
      const randomSelection = selectRandomFallback();
      winner = randomSelection.winner;
      eligiblePool = randomSelection.eligiblePool;
    }

    if (winner < normalized.minNumber || winner > normalized.maxNumber) {
      throw new SpinValidationError("Selected winner is outside the current draw range.");
    }

    const result = await tx.privateDrawSpinResult.create({
      data: {
        privateDrawId: normalized.id,
        requestedMin,
        requestedMax,
        winningNumber: winner,
        eligibleCount: eligiblePool.length,
        mode: resultMode,
        hashedIp,
        userAgent
      }
    });

    return {
      spinId: result.id,
      winner,
      timestamp: result.createdAt.toISOString(),
      from: requestedMin,
      to: requestedMax,
      mode: resultMode,
      nextLabel: getPrivateDrawAudienceLabel(normalized.mode, null)
    };
  });
}

export async function archivePrivateDraw(id: string) {
  const draw = await prisma.privateDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PrivateDrawNotFoundError();
  }

  if (draw.archivedAt) {
    return normalizePrivateDraw(draw);
  }

  if (draw.isActive) {
    throw new PrivateDrawStateError("Deactivate the draw before archiving it.");
  }

  const archived = await prisma.privateDraw.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      isActive: false,
      pendingOperatorWinner: null
    }
  });

  return normalizePrivateDraw(archived);
}

export async function restorePrivateDraw(id: string) {
  const draw = await prisma.privateDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PrivateDrawNotFoundError();
  }

  if (!draw.archivedAt) {
    return normalizePrivateDraw(draw);
  }

  const restored = await prisma.privateDraw.update({
    where: { id },
    data: {
      archivedAt: null,
      isActive: false
    }
  });

  return normalizePrivateDraw(restored);
}

export async function deletePrivateDrawPermanently(id: string) {
  const draw = await prisma.privateDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PrivateDrawNotFoundError();
  }

  if (!draw.archivedAt) {
    throw new PrivateDrawStateError("Archive the draw before permanently deleting it.");
  }

  await prisma.privateDraw.delete({ where: { id } });

  return { id };
}
