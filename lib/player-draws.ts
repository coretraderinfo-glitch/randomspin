import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SpinValidationError } from "@/lib/spin";

export const PLAYER_DRAW_RANDOM_MODE = "RANDOM";
export const PLAYER_DRAW_OPERATOR_MODE = "OPERATOR";
export const PLAYER_DRAW_MAX_PARTICIPANTS = 1000;

export type PlayerDrawMode = typeof PLAYER_DRAW_RANDOM_MODE | typeof PLAYER_DRAW_OPERATOR_MODE;

export type PlayerParticipantInput = {
  id?: string;
  displayName: string;
  reference?: string | null;
  isEligible?: boolean;
};

export type NormalizedPlayerParticipant = {
  id?: string;
  displayName: string;
  reference: string | null;
  isEligible: boolean;
};

export type PlayerDrawMutationInput = {
  name: string;
  mode: PlayerDrawMode;
  isActive: boolean;
  removeWinnerAfterWin: boolean;
  showParticipantList: boolean;
  showReferencesPublicly: boolean;
  participants?: PlayerParticipantInput[];
  nextWinnerParticipantId?: string | null;
  clearPendingWinner?: boolean;
};

export class PlayerDrawNotFoundError extends Error {
  constructor() {
    super("Player draw not found.");
    this.name = "PlayerDrawNotFoundError";
  }
}

export class PlayerDrawStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerDrawStateError";
  }
}

const publicCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isPlayerDrawMode(value: unknown): value is PlayerDrawMode {
  return value === PLAYER_DRAW_RANDOM_MODE || value === PLAYER_DRAW_OPERATOR_MODE;
}

export function getPlayerDrawAudienceLabel(mode: string) {
  return mode === PLAYER_DRAW_OPERATOR_MODE ? "OPERATOR DRAW" : "RANDOM DRAW";
}

export function generatePlayerDrawPublicCode() {
  let suffix = "";

  for (let index = 0; index < 4; index += 1) {
    suffix += publicCodeAlphabet[randomInt(publicCodeAlphabet.length)];
  }

  return `PLAY${suffix}`;
}

export function normalizePlayerParticipants(input: PlayerParticipantInput[]) {
  if (!Array.isArray(input)) {
    throw new SpinValidationError("Participant list is required.");
  }

  if (input.length > PLAYER_DRAW_MAX_PARTICIPANTS) {
    throw new SpinValidationError(`Use ${PLAYER_DRAW_MAX_PARTICIPANTS} participants or fewer.`);
  }

  const participants = input
    .map((participant) => ({
      id: participant.id ? sanitizeText(participant.id, 80) : undefined,
      displayName: sanitizeText(participant.displayName, 120),
      reference: sanitizeText(participant.reference, 80) || null,
      isEligible: participant.isEligible !== false
    }))
    .filter((participant) => participant.displayName.length > 0);

  if (participants.length === 0) {
    throw new SpinValidationError("Add at least one participant.");
  }

  return participants;
}

export function detectDuplicateNames(participants: Array<{ displayName: string }>) {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const participant of participants) {
    const key = participant.displayName.trim().toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows;
}

export function parseParticipantCsv(text: string) {
  if (text.length > 120_000) {
    throw new SpinValidationError("CSV file is too large.");
  }

  const rows = parseCsvRows(text).filter((row) => row.some((cell) => sanitizeText(cell, 120)));
  const [firstRow] = rows;
  const hasHeader = firstRow?.[0]?.trim().toLowerCase() === "name";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return normalizePlayerParticipants(
    dataRows.map((row) => ({
      displayName: row[0] ?? "",
      reference: row[1] ?? null,
      isEligible: true
    }))
  );
}

export function parseParticipantLines(text: string) {
  return normalizePlayerParticipants(
    text.split(/\r?\n/).map((line) => ({
      displayName: line,
      reference: null,
      isEligible: true
    }))
  );
}

export function escapeCsvCell(value: string | null | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportParticipantsCsv(participants: Array<{ displayName: string; reference: string | null; isEligible: boolean }>) {
  const rows = [["Name", "Reference", "Eligible"].map((value) => escapeCsvCell(value)).join(",")];

  for (const participant of participants) {
    rows.push(
      [participant.displayName, participant.reference, participant.isEligible ? "YES" : "NO"].map((value) => escapeCsvCell(value)).join(",")
    );
  }

  return `${rows.join("\n")}\n`;
}

export function selectSecurePlayerWinner<T>(eligibleParticipants: T[]) {
  if (eligibleParticipants.length === 0) {
    throw new SpinValidationError("No eligible participants are available.");
  }

  return eligibleParticipants[randomInt(eligibleParticipants.length)];
}

function normalizeDrawMode(mode: string): PlayerDrawMode {
  return mode === PLAYER_DRAW_OPERATOR_MODE ? PLAYER_DRAW_OPERATOR_MODE : PLAYER_DRAW_RANDOM_MODE;
}

function assertValidMode(mode: PlayerDrawMode) {
  if (!isPlayerDrawMode(mode)) {
    throw new SpinValidationError("Use a valid player draw mode.");
  }
}

async function createUniquePlayerPublicCode(tx: { playerDraw: Pick<typeof prisma.playerDraw, "findUnique"> } = prisma) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generatePlayerDrawPublicCode();
    const existing = await tx.playerDraw.findUnique({ where: { publicCode: code }, select: { id: true } });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Could not generate a unique player draw code.");
}

function participantForPublic(
  participant: { id: string; displayName: string; reference: string | null; isEligible: boolean },
  showReferencesPublicly = true,
  index = 0
) {
  void participant.id;

  return {
    id: `player-${index + 1}`,
    displayName: participant.displayName,
    reference: showReferencesPublicly ? participant.reference : null,
    isEligible: participant.isEligible
  };
}

export async function listPlayerDraws() {
  const draws = await prisma.playerDraw.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      participants: { select: { isEligible: true } },
      _count: { select: { results: true } }
    }
  });

  return draws.map((draw) => ({
    id: draw.id,
    publicCode: draw.publicCode,
    name: draw.name,
    mode: normalizeDrawMode(draw.mode),
    pendingOperatorParticipantId: draw.pendingOperatorParticipantId,
    isActive: draw.isActive,
    archivedAt: draw.archivedAt,
    removeWinnerAfterWin: draw.removeWinnerAfterWin,
    showParticipantList: draw.showParticipantList,
    showReferencesPublicly: draw.showReferencesPublicly,
    participantCount: draw.participants.length,
    eligibleCount: draw.participants.filter((participant) => participant.isEligible).length,
    resultCount: draw._count.results,
    createdAt: draw.createdAt,
    updatedAt: draw.updatedAt
  }));
}

export async function getPlayerDrawAudience(publicCode: string) {
  const draw = await prisma.playerDraw.findUnique({
    where: { publicCode },
    include: {
      participants: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!draw || !draw.isActive || draw.archivedAt) {
    return null;
  }

  const eligibleParticipants = draw.participants.filter((participant) => participant.isEligible);

  return {
    id: draw.id,
    publicCode: draw.publicCode,
    name: draw.name,
    mode: normalizeDrawMode(draw.mode),
    label: getPlayerDrawAudienceLabel(draw.mode),
    participantCount: draw.participants.length,
    eligibleCount: eligibleParticipants.length,
    removeWinnerAfterWin: draw.removeWinnerAfterWin,
    showParticipantList: draw.showParticipantList,
    showReferencesPublicly: draw.showReferencesPublicly,
    participants: draw.showParticipantList
      ? draw.participants.map((participant, index) => participantForPublic(participant, draw.showReferencesPublicly, index))
      : []
  };
}

export async function getPlayerDrawForAdmin(id: string) {
  const draw = await prisma.playerDraw.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { createdAt: "asc" } },
      results: {
        orderBy: { createdAt: "desc" },
        take: 30
      }
    }
  });

  if (!draw) {
    return null;
  }

  return {
    id: draw.id,
    publicCode: draw.publicCode,
    name: draw.name,
    mode: normalizeDrawMode(draw.mode),
    pendingOperatorParticipantId: draw.pendingOperatorParticipantId,
    isActive: draw.isActive,
    archivedAt: draw.archivedAt,
    removeWinnerAfterWin: draw.removeWinnerAfterWin,
    showParticipantList: draw.showParticipantList,
    showReferencesPublicly: draw.showReferencesPublicly,
    participants: draw.participants,
    participantCount: draw.participants.length,
    eligibleCount: draw.participants.filter((participant) => participant.isEligible).length,
    results: draw.results
  };
}

export async function createPlayerDraw(input: PlayerDrawMutationInput) {
  assertValidMode(input.mode);
  const participants = normalizePlayerParticipants(input.participants ?? []);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.playerDraw.create({
          data: {
            publicCode: await createUniquePlayerPublicCode(tx),
            name: sanitizeText(input.name, 120) || "Player Draw",
            mode: input.mode,
            isActive: input.isActive,
            removeWinnerAfterWin: input.removeWinnerAfterWin,
            showParticipantList: input.showParticipantList,
            showReferencesPublicly: input.showReferencesPublicly,
            participants: {
              create: participants.map((participant) => ({
                ...(participant.id ? { id: participant.id } : {}),
                displayName: participant.displayName,
                reference: participant.reference,
                isEligible: participant.isEligible
              }))
            }
          }
        });

        return created;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Could not create player draw.");
}

async function validatePendingParticipant(tx: Prisma.TransactionClient, drawId: string, participantId: string | null) {
  if (participantId === null) {
    return null;
  }

  const participant = await tx.playerParticipant.findFirst({
    where: { id: participantId, playerDrawId: drawId, isEligible: true }
  });

  if (!participant) {
    throw new SpinValidationError("Next winner must be an eligible participant in this draw.");
  }

  return participant.id;
}

export async function updatePlayerDraw({
  id,
  input
}: {
  id: string;
  input: PlayerDrawMutationInput;
}) {
  assertValidMode(input.mode);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.playerDraw.findUnique({ where: { id } });

    if (!existing) {
      throw new PlayerDrawNotFoundError();
    }

    if (input.participants) {
      const participants = normalizePlayerParticipants(input.participants);
      await tx.playerDraw.update({
        where: { id },
        data: { pendingOperatorParticipantId: null }
      });
      await tx.playerParticipant.deleteMany({ where: { playerDrawId: id } });
      await tx.playerParticipant.createMany({
        data: participants.map((participant) => ({
          ...(participant.id ? { id: participant.id } : {}),
          playerDrawId: id,
          displayName: participant.displayName,
          reference: participant.reference,
          isEligible: participant.isEligible
        }))
      });
    }

    let pendingOperatorParticipantId: string | null = existing.pendingOperatorParticipantId;
    if (input.mode === PLAYER_DRAW_RANDOM_MODE || input.clearPendingWinner || input.nextWinnerParticipantId === null) {
      pendingOperatorParticipantId = null;
    } else if (input.nextWinnerParticipantId !== undefined) {
      pendingOperatorParticipantId = await validatePendingParticipant(tx, id, input.nextWinnerParticipantId);
    } else if (pendingOperatorParticipantId) {
      const stillValid = await tx.playerParticipant.findFirst({
        where: { id: pendingOperatorParticipantId, playerDrawId: id, isEligible: true },
        select: { id: true }
      });
      pendingOperatorParticipantId = stillValid ? pendingOperatorParticipantId : null;
    }

    return tx.playerDraw.update({
      where: { id },
      data: {
        name: sanitizeText(input.name, 120) || "Player Draw",
        mode: input.mode,
        isActive: input.isActive,
        removeWinnerAfterWin: input.removeWinnerAfterWin,
        showParticipantList: input.showParticipantList,
        showReferencesPublicly: input.showReferencesPublicly,
        pendingOperatorParticipantId
      }
    });
  });
}

export async function createPublicPlayerSpin({
  participants
}: {
  participants: PlayerParticipantInput[];
}) {
  const normalizedParticipants = normalizePlayerParticipants(participants);
  const eligibleParticipants = normalizedParticipants.filter((participant) => participant.isEligible);
  const winner = selectSecurePlayerWinner(eligibleParticipants);

  return {
    spinId: `player-local-${Date.now().toString(36)}-${randomInt(1_000_000).toString(36)}`,
    participantId: winner.id ?? null,
    displayName: winner.displayName,
    reference: winner.reference,
    eligibleCount: eligibleParticipants.length,
    timestamp: new Date().toISOString(),
    mode: PLAYER_DRAW_RANDOM_MODE
  };
}

export async function createPrivatePlayerDrawSpin({
  publicCode,
  hashedIp,
  userAgent
}: {
  publicCode: string;
  hashedIp?: string;
  userAgent?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const draw = await tx.playerDraw.findUnique({ where: { publicCode } });

    if (!draw || !draw.isActive || draw.archivedAt) {
      throw new PlayerDrawNotFoundError();
    }

    const mode = normalizeDrawMode(draw.mode);
    let winner: { id: string; displayName: string; reference: string | null; isEligible: boolean };
    let eligibleCount = 0;

    if (mode === PLAYER_DRAW_OPERATOR_MODE) {
      if (!draw.pendingOperatorParticipantId) {
        throw new SpinValidationError("This player draw is not ready yet.");
      }

      const pending = await tx.playerParticipant.findFirst({
        where: { id: draw.pendingOperatorParticipantId, playerDrawId: draw.id, isEligible: true }
      });

      if (!pending) {
        throw new SpinValidationError("This player draw is not ready yet.");
      }

      const consumed = await tx.playerDraw.updateMany({
        where: {
          id: draw.id,
          pendingOperatorParticipantId: pending.id
        },
        data: {
          pendingOperatorParticipantId: null
        }
      });

      if (consumed.count !== 1) {
        throw new SpinValidationError("This player draw is not ready yet.");
      }

      winner = pending;
      eligibleCount = await tx.playerParticipant.count({ where: { playerDrawId: draw.id, isEligible: true } });
    } else {
      const eligible = await tx.playerParticipant.findMany({
        where: { playerDrawId: draw.id, isEligible: true },
        orderBy: { createdAt: "asc" }
      });
      winner = selectSecurePlayerWinner(eligible);
      eligibleCount = eligible.length;
    }

    const result = await tx.playerDrawResult.create({
      data: {
        playerDrawId: draw.id,
        participantId: winner.id,
        displayNameSnapshot: winner.displayName,
        referenceSnapshot: winner.reference,
        mode
      }
    });

    if (draw.removeWinnerAfterWin) {
      await tx.playerParticipant.update({
        where: { id: winner.id },
        data: { isEligible: false }
      });
    }

    void hashedIp;
    void userAgent;

    return {
      spinId: result.id,
      participantId: winner.id,
      displayName: winner.displayName,
      reference: draw.showReferencesPublicly ? winner.reference : null,
      eligibleCount,
      timestamp: result.createdAt.toISOString(),
      mode
    };
  });
}

export async function archivePlayerDraw(id: string) {
  const draw = await prisma.playerDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PlayerDrawNotFoundError();
  }

  if (draw.archivedAt) {
    return draw;
  }

  if (draw.isActive) {
    throw new PlayerDrawStateError("Deactivate the player draw before archiving it.");
  }

  return prisma.playerDraw.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      isActive: false,
      pendingOperatorParticipantId: null
    }
  });
}

export async function restorePlayerDraw(id: string) {
  const draw = await prisma.playerDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PlayerDrawNotFoundError();
  }

  if (!draw.archivedAt) {
    return draw;
  }

  return prisma.playerDraw.update({
    where: { id },
    data: {
      archivedAt: null,
      isActive: false
    }
  });
}

export async function deletePlayerDrawPermanently(id: string) {
  const draw = await prisma.playerDraw.findUnique({ where: { id } });

  if (!draw) {
    throw new PlayerDrawNotFoundError();
  }

  if (!draw.archivedAt) {
    throw new PlayerDrawStateError("Archive the player draw before permanently deleting it.");
  }

  await prisma.playerDraw.delete({ where: { id } });

  return { id };
}
