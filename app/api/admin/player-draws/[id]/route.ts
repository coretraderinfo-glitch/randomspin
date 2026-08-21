import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFromRequest } from "@/lib/auth";
import {
  PLAYER_DRAW_OPERATOR_MODE,
  PLAYER_DRAW_RANDOM_MODE,
  PlayerDrawNotFoundError,
  getPlayerDrawForAdmin,
  updatePlayerDraw,
  type PlayerDrawMode
} from "@/lib/player-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const participantSchema = z.object({
  id: z.string().max(80).optional(),
  displayName: z.string().max(160),
  reference: z.string().max(100).nullable().optional(),
  isEligible: z.boolean().optional()
});

const playerDrawSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mode: z.enum([PLAYER_DRAW_RANDOM_MODE, PLAYER_DRAW_OPERATOR_MODE]),
  isActive: z.boolean(),
  removeWinnerAfterWin: z.boolean(),
  showParticipantList: z.boolean(),
  showReferencesPublicly: z.boolean(),
  participants: z.array(participantSchema).max(1000).optional(),
  nextWinnerParticipantId: z.string().max(80).nullable().optional(),
  action: z.enum(["set", "clear", "save"]).optional()
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await params;
  const draw = await getPlayerDrawForAdmin(id);
  if (!draw) {
    return jsonError("Player draw not found.", 404);
  }

  return NextResponse.json({ draw });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = playerDrawSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid player draw settings.", 400);
    }

    const { id } = await params;
    const draw = await updatePlayerDraw({
      id,
      input: {
        ...parsed.data,
        mode: parsed.data.mode as PlayerDrawMode,
        clearPendingWinner: parsed.data.action === "clear"
      }
    });

    return NextResponse.json({ draw, message: "Player draw settings saved." });
  } catch (error) {
    if (error instanceof PlayerDrawNotFoundError) {
      return jsonError("Player draw not found.", 404);
    }

    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Player draw admin error", error);
    return jsonError("Player draw settings could not be saved.", 500);
  }
}
