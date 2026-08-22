import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { getAdminFromRequest } from "@/lib/auth";
import {
  PRIVATE_DRAW_CARD_REVEAL_DISPLAY,
  PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY,
  PRIVATE_DRAW_SLOT_NUMBER_DISPLAY,
  PRIVATE_DRAW_WHEEL_DISPLAY
} from "@/lib/private-draw-display";
import {
  PRIVATE_DRAW_OPERATOR_MODE,
  PRIVATE_DRAW_RANDOM_MODE,
  PrivateDrawSlugError,
  createPrivateDraw,
  listPrivateDraws,
  type PrivateDrawMode
} from "@/lib/private-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const drawCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  liveSlug: z.string().max(80).nullable().optional(),
  minNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  maxNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  excludedNumbers: z.array(z.number().int()).max(1000).optional(),
  excludedText: z.string().max(5000).optional(),
  mode: z.enum([PRIVATE_DRAW_RANDOM_MODE, PRIVATE_DRAW_OPERATOR_MODE]).default(PRIVATE_DRAW_RANDOM_MODE),
  displayStyle: z
    .enum([PRIVATE_DRAW_WHEEL_DISPLAY, PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY, PRIVATE_DRAW_SLOT_NUMBER_DISPLAY, PRIVATE_DRAW_CARD_REVEAL_DISPLAY])
    .default(PRIVATE_DRAW_WHEEL_DISPLAY),
  isActive: z.boolean().default(true),
  nextWinner: z.coerce.number().int().nullable().optional()
});

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  return NextResponse.json({ draws: await listPrivateDraws() });
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

    const parsed = drawCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid private draw details.", 400);
    }

    const draw = await createPrivateDraw({
      name: parsed.data.name,
      liveSlug: parsed.data.liveSlug,
      minNumber: parsed.data.minNumber,
      maxNumber: parsed.data.maxNumber,
      excludedNumbers: parsed.data.excludedNumbers,
      excludedText: parsed.data.excludedText,
      mode: parsed.data.mode as PrivateDrawMode,
      displayStyle: parsed.data.displayStyle,
      isActive: parsed.data.isActive,
      nextWinner: parsed.data.nextWinner
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PRIVATE_DRAW_CREATED",
      target: `PrivateDraw:${draw.id}`,
      request,
      metadata: {
        mode: draw.mode,
        range: { minNumber: draw.minNumber, maxNumber: draw.maxNumber },
        excludedCount: draw.excludedNumbers.length,
        isActive: draw.isActive,
        liveSlugSet: Boolean(draw.liveSlug),
        nextWinnerConfigured: parsed.data.nextWinner !== undefined && parsed.data.nextWinner !== null
      }
    });

    return NextResponse.json({ draw, message: "Private draw created successfully." }, { status: 201 });
  } catch (error) {
    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof PrivateDrawSlugError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw create error", error);
    return jsonError("Private draw could not be created.", 500);
  }
}
