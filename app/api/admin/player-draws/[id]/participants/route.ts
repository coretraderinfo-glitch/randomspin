import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFromRequest } from "@/lib/auth";
import {
  getPlayerDrawForAdmin,
  PlayerDrawConflictError,
  PlayerDrawNotFoundError,
  PlayerDrawStateError,
  replacePlayerDrawParticipants,
} from "@/lib/player-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  revision: z.string().datetime(),
  participants: z.array(z.object({
    id: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().max(160),
    reference: z.string().max(100).nullable().optional()
  }).strict()).max(1000)
}).strict();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let drawId: string | null = null;
  try {
    if (!requireSameOrigin(request)) return jsonError("Invalid request origin.", 403);
    if (!await getAdminFromRequest(request)) return jsonError("Unauthorized.", 401);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid participant list.", 400);
    const { id } = await params;
    drawId = id;
    const draw = await replacePlayerDrawParticipants({ id, ...parsed.data });
    return NextResponse.json({
      participants: draw.participants,
      participantCount: draw.participants.length,
      eligibleCount: draw.participants.filter((participant) => participant.isEligible).length,
      revision: draw.updatedAt.toISOString()
    });
  } catch (error) {
    if (error instanceof PlayerDrawConflictError) {
      const current = drawId ? await getPlayerDrawForAdmin(drawId) : null;
      return NextResponse.json({
        error: error.message,
        participants: current?.participants ?? [],
        participantCount: current?.participantCount ?? 0,
        eligibleCount: current?.eligibleCount ?? 0,
        revision: current?.updatedAt.toISOString() ?? null,
      }, { status: 409 });
    }
    if (error instanceof PlayerDrawNotFoundError) return jsonError("Player draw not found.", 404);
    if (error instanceof PlayerDrawStateError || error instanceof SpinValidationError) return jsonError(error.message, 400);
    console.error("Player draw participant update error", error);
    return jsonError("Unable to update players.", 500);
  }
}
