import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { getAdminFromRequest } from "@/lib/auth";
import {
  PLAYER_DRAW_OPERATOR_MODE,
  PLAYER_DRAW_RANDOM_MODE,
  PlayerDrawNotFoundError,
  PlayerDrawStateError,
  archivePlayerDraw,
  deletePlayerDrawPermanently,
  getPlayerDrawForAdmin,
  restorePlayerDraw,
  updatePlayerDraw,
  type PlayerDrawMode,
} from "@/lib/player-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const playerDrawSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mode: z.enum([PLAYER_DRAW_RANDOM_MODE, PLAYER_DRAW_OPERATOR_MODE]),
  isActive: z.boolean(),
  removeWinnerAfterWin: z.boolean(),
  showParticipantList: z.boolean(),
  showReferencesPublicly: z.boolean(),
  nextWinnerParticipantId: z.string().max(80).nullable().optional(),
  action: z.enum(["set", "clear", "save"]).optional(),
}).strict();

const playerDrawArchiveActionSchema = z.object({
  action: z.enum(["archive", "restore"]),
});

const deleteConfirmationSchema = z.object({
  confirmation: z.literal("PERMANENTLY DELETE"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = playerDrawSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Invalid player draw settings.", 400);
    }

    const { id } = await params;
    const previous = await getPlayerDrawForAdmin(id);
    const updated = await updatePlayerDraw({
      id,
      input: {
        ...parsed.data,
        mode: parsed.data.mode as PlayerDrawMode,
        clearPendingWinner: parsed.data.action === "clear",
      },
    });
    const draw = await getPlayerDrawForAdmin(id);
    if (!draw) {
      throw new PlayerDrawNotFoundError();
    }

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PLAYER_DRAW_UPDATED",
      target: `PlayerDraw:${draw.id}`,
      request,
      metadata: {
        modeChanged: previous ? previous.mode !== updated.mode : null,
        activationChanged: previous
          ? previous.isActive !== updated.isActive
          : null,
        nextWinnerAction:
          parsed.data.action === "clear"
            ? "clear"
            : parsed.data.nextWinnerParticipantId
              ? "set"
              : null,
        removeWinnerAfterWinChanged: previous
          ? previous.removeWinnerAfterWin !== updated.removeWinnerAfterWin
          : null,
        showParticipantListChanged: previous
          ? previous.showParticipantList !== updated.showParticipantList
          : null,
        showReferencesPubliclyChanged: previous
          ? previous.showReferencesPublicly !== updated.showReferencesPublicly
          : null,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = playerDrawArchiveActionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Invalid player draw action.", 400);
    }

    const { id } = await params;
    const draw =
      parsed.data.action === "archive"
        ? await archivePlayerDraw(id)
        : await restorePlayerDraw(id);

    await logAdminAudit({
      adminUserId: admin.id,
      action:
        parsed.data.action === "archive"
          ? "PLAYER_DRAW_ARCHIVED"
          : "PLAYER_DRAW_RESTORED",
      target: `PlayerDraw:${draw.id}`,
      request,
    });

    return NextResponse.json({
      draw,
      message:
        parsed.data.action === "archive"
          ? "Player draw archived successfully."
          : "Player draw restored successfully.",
    });
  } catch (error) {
    if (error instanceof PlayerDrawNotFoundError) {
      return jsonError("Player draw not found.", 404);
    }

    if (
      error instanceof PlayerDrawStateError ||
      error instanceof SpinValidationError
    ) {
      return jsonError(error.message, 400);
    }

    console.error("Player draw archive action error", error);
    return jsonError("Player draw action could not be completed.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = deleteConfirmationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Deletion confirmation is required.", 400);
    }

    const { id } = await params;
    await deletePlayerDrawPermanently(id);

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PLAYER_DRAW_DELETED",
      target: `PlayerDraw:${id}`,
      request,
    });

    return NextResponse.json({
      deletedId: id,
      message: "Player draw permanently deleted.",
    });
  } catch (error) {
    if (error instanceof PlayerDrawNotFoundError) {
      return jsonError("Player draw not found.", 404);
    }

    if (
      error instanceof PlayerDrawStateError ||
      error instanceof SpinValidationError
    ) {
      return jsonError(error.message, 400);
    }

    console.error("Player draw delete error", error);
    return jsonError("Player draw could not be permanently deleted.", 500);
  }
}
