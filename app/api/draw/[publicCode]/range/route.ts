import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { getAdminFromRequest } from "@/lib/auth";
import { PrivateDrawNotFoundError, PrivateDrawRangeConflictError, getPrivateDrawAudience, updatePrivateDrawLiveRange } from "@/lib/private-draws";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const liveRangeSchema = z.object({
  from: z.coerce.number().int().min(0).max(1_000_000),
  to: z.coerce.number().int().min(0).max(1_000_000),
  revision: z.string().datetime()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ publicCode: string }> }) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = liveRangeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid live draw range.", 400);
    }

    const { publicCode } = await params;
    const previous = await getPrivateDrawAudience(publicCode);
    const state = await updatePrivateDrawLiveRange({
      publicCode,
      minNumber: parsed.data.from,
      maxNumber: parsed.data.to,
      revision: parsed.data.revision
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "PRIVATE_DRAW_LIVE_RANGE_UPDATED",
      target: `PrivateDraw:${state.id}`,
      request,
      metadata: {
        fromBefore: previous?.minNumber ?? null,
        toBefore: previous?.maxNumber ?? null,
        fromAfter: state.minNumber,
        toAfter: state.maxNumber
      }
    });

    return NextResponse.json({
      from: state.minNumber,
      to: state.maxNumber,
      label: state.label,
      displayStyle: state.displayStyle,
      revision: state.revision
    });
  } catch (error) {
    if (error instanceof PrivateDrawRangeConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current:
            error.currentState === null
              ? null
              : {
                  from: error.currentState.minNumber,
                  to: error.currentState.maxNumber,
                  label: error.currentState.label,
                  displayStyle: error.currentState.displayStyle,
                  revision: error.currentState.revision
                }
        },
        { status: 409 }
      );
    }

    if (error instanceof PrivateDrawNotFoundError) {
      return jsonError("Draw not found.", 404);
    }

    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw live range error", error);
    return jsonError("Live draw range could not be saved.", 500);
  }
}
