import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { getAdminFromRequest } from "@/lib/auth";
import {
  PLAYER_DRAW_OPERATOR_MODE,
  PLAYER_DRAW_RANDOM_MODE,
  createPlayerDraw,
  listPlayerDraws,
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
  mode: z.enum([PLAYER_DRAW_RANDOM_MODE, PLAYER_DRAW_OPERATOR_MODE]).default(PLAYER_DRAW_RANDOM_MODE),
  isActive: z.boolean().default(true),
  removeWinnerAfterWin: z.boolean().default(false),
  showParticipantList: z.boolean().default(true),
  showReferencesPublicly: z.boolean().default(true),
  participants: z.array(participantSchema).max(1000)
});

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  return NextResponse.json({ draws: await listPlayerDraws() });
}

export async function POST(request: NextRequest) {
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
      return jsonError("Invalid player draw details.", 400);
    }

    const draw = await createPlayerDraw({
      ...parsed.data,
      mode: parsed.data.mode as PlayerDrawMode
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PLAYER_DRAW_CREATED",
      target: `PlayerDraw:${draw.id}`,
      request,
      metadata: {
        mode: draw.mode,
        isActive: draw.isActive,
        participantCount: parsed.data.participants.length,
        removeWinnerAfterWin: draw.removeWinnerAfterWin,
        showParticipantList: draw.showParticipantList,
        showReferencesPublicly: draw.showReferencesPublicly
      }
    });

    return NextResponse.json({ draw, message: "Player draw created successfully." }, { status: 201 });
  } catch (error) {
    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Player draw create error", error);
    return jsonError("Player draw could not be created.", 500);
  }
}
