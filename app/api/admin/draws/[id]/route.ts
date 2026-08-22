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
  PrivateDrawNotFoundError,
  PrivateDrawSlugError,
  PrivateDrawStateError,
  archivePrivateDraw,
  deletePrivateDrawPermanently,
  getPrivateDrawForAdmin,
  restorePrivateDraw,
  updatePrivateDraw,
  type PrivateDrawMode
} from "@/lib/private-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const drawUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  liveSlug: z.string().max(80).nullable().optional(),
  minNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  maxNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  excludedNumbers: z.array(z.number().int()).max(1000).optional(),
  excludedText: z.string().max(5000).optional(),
  mode: z.enum([PRIVATE_DRAW_RANDOM_MODE, PRIVATE_DRAW_OPERATOR_MODE]),
  displayStyle: z.enum([
    PRIVATE_DRAW_WHEEL_DISPLAY,
    PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY,
    PRIVATE_DRAW_SLOT_NUMBER_DISPLAY,
    PRIVATE_DRAW_CARD_REVEAL_DISPLAY
  ]),
  isActive: z.boolean(),
  nextWinner: z.coerce.number().int().nullable().optional(),
  action: z.enum(["set", "clear"]).optional()
});

const drawArchiveActionSchema = z.object({
  action: z.enum(["archive", "restore"])
});

const deleteConfirmationSchema = z.object({
  confirmation: z.literal("PERMANENTLY DELETE")
});

function sameNumbers(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await params;
  const draw = await getPrivateDrawForAdmin(id);

  if (!draw) {
    return jsonError("Draw not found.", 404);
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

    const parsed = drawUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid draw settings.", 400);
    }

    const { id } = await params;
    const previous = await getPrivateDrawForAdmin(id);
    const result = await updatePrivateDraw({
      id,
      input: {
        name: parsed.data.name,
        liveSlug: parsed.data.liveSlug,
        minNumber: parsed.data.minNumber,
        maxNumber: parsed.data.maxNumber,
        excludedNumbers: parsed.data.excludedNumbers,
        excludedText: parsed.data.excludedText,
        mode: parsed.data.mode as PrivateDrawMode,
        displayStyle: parsed.data.displayStyle,
        isActive: parsed.data.isActive,
        nextWinner: parsed.data.nextWinner,
        clearPendingWinner: parsed.data.action === "clear"
      }
    });
    const message = result.pendingWinnerCleared
      ? "Draw settings saved. Pending operator winner was cleared because it is no longer valid."
      : "Draw settings saved.";

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PRIVATE_DRAW_UPDATED",
      target: `PrivateDraw:${result.draw.id}`,
      request,
      metadata: {
        modeChanged: previous ? previous.mode !== result.draw.mode : null,
        rangeChanged: previous ? previous.minNumber !== result.draw.minNumber || previous.maxNumber !== result.draw.maxNumber : null,
        exclusionsChanged: previous ? !sameNumbers(previous.excludedNumbers, result.draw.excludedNumbers) : null,
        activationChanged: previous ? previous.isActive !== result.draw.isActive : null,
        displayStyleChanged: previous ? previous.displayStyle !== result.draw.displayStyle : null,
        liveSlugChanged: previous ? previous.liveSlug !== result.draw.liveSlug : null,
        nextWinnerAction: parsed.data.action ?? (parsed.data.nextWinner !== undefined ? "set" : null),
        pendingWinnerCleared: result.pendingWinnerCleared
      }
    });

    return NextResponse.json({ draw: result.draw, message });
  } catch (error) {
    if (error instanceof PrivateDrawNotFoundError) {
      return jsonError("Draw not found.", 404);
    }

    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof PrivateDrawSlugError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw admin error", error);
    return jsonError("Draw settings could not be saved.", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = drawArchiveActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid draw action.", 400);
    }

    const { id } = await params;
    const draw = parsed.data.action === "archive" ? await archivePrivateDraw(id) : await restorePrivateDraw(id);

    await logAdminAudit({
      adminUserId: admin.id,
      action: parsed.data.action === "archive" ? "PRIVATE_DRAW_ARCHIVED" : "PRIVATE_DRAW_RESTORED",
      target: `PrivateDraw:${draw.id}`,
      request
    });

    return NextResponse.json({
      draw,
      message: parsed.data.action === "archive" ? "Draw archived successfully." : "Draw restored successfully."
    });
  } catch (error) {
    if (error instanceof PrivateDrawNotFoundError) {
      return jsonError("Draw not found.", 404);
    }

    if (error instanceof PrivateDrawStateError || error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof PrivateDrawSlugError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw archive action error", error);
    return jsonError("Draw action could not be completed.", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = deleteConfirmationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Deletion confirmation is required.", 400);
    }

    const { id } = await params;
    await deletePrivateDrawPermanently(id);

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PRIVATE_DRAW_DELETED",
      target: `PrivateDraw:${id}`,
      request
    });

    return NextResponse.json({ deletedId: id, message: "Draw permanently deleted." });
  } catch (error) {
    if (error instanceof PrivateDrawNotFoundError) {
      return jsonError("Draw not found.", 404);
    }

    if (error instanceof PrivateDrawStateError || error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw delete error", error);
    return jsonError("Draw could not be permanently deleted.", 500);
  }
}
