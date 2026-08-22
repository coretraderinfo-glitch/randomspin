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
  minNumber: number;
  maxNumber: number;
  excludedNumbers?: number[];
  excludedText?: string;
  mode: PrivateDrawMode;
  displayStyle?: PrivateDrawDisplayStyle;
  isActive: boolean;
  nextWinner?: number | null;
  clearPendingWinner?: boolean;
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

const publicCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const publicCodeLength = 8;

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

function getExcludedNumbers(input: PrivateDrawMutationInput) {
  const excludedNumbers =
    input.excludedText !== undefined
      ? parseExcludedNumbers(input.excludedText, input.minNumber, input.maxNumber)
      : Array.from(new Set(input.excludedNumbers ?? [])).sort((a, b) => a - b);

  if (excludedNumbers.some((value) => !Number.isInteger(value) || value < input.minNumber || value > input.maxNumber)) {
    const invalid = excludedNumbers.filter((value) => !Number.isInteger(value) || value < input.minNumber || value > input.maxNumber);
    throw new SpinValidationError(`Excluded numbers outside the new range: ${invalid.join(", ")}`);
  }

  return excludedNumbers;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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
  const draw = await prisma.privateDraw.findUnique({ where: { publicCode } });

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

  return {
    id: normalized.id,
    publicCode: normalized.publicCode,
    name: normalized.name,
    minNumber: normalized.minNumber,
    maxNumber: normalized.maxNumber,
    mode: normalized.mode,
    displayStyle: normalized.displayStyle,
    label: getPrivateDrawAudienceLabel(normalized.mode, pendingOperatorWinner)
  };
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

  const excludedNumbers = getExcludedNumbers(input);
  const displayStyle = normalizePrivateDrawDisplayStyle(input.displayStyle);
  const provisionalDraw = normalizePrivateDraw({
    id: "new",
    publicCode: "PENDING",
    name: input.name,
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

  validateDrawRange(input.minNumber, input.maxNumber);

  if (!isPrivateDrawMode(input.mode)) {
    throw new SpinValidationError("Use a valid draw mode.");
  }

  const excludedNumbers = getExcludedNumbers(input);
  const displayStyle = normalizePrivateDrawDisplayStyle(input.displayStyle ?? draw.displayStyle);
  const nextDraw = normalizePrivateDraw({
    ...draw,
    name: input.name,
    minNumber: input.minNumber,
    maxNumber: input.maxNumber,
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
      minNumber: input.minNumber,
      maxNumber: input.maxNumber,
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
    const draw = await tx.privateDraw.findUnique({ where: { publicCode } });

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
      winner: result.winningNumber,
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
