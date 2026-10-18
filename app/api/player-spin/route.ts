import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createPublicPlayerSpin } from "@/lib/player-draws";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, jsonError } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const participantSchema = z.object({
  id: z.string().max(80).optional(),
  displayName: z.string().max(160),
  reference: z.string().max(100).nullable().optional(),
  isEligible: z.boolean().optional()
});

const spinSchema = z.object({
  participants: z.array(participantSchema).max(1000)
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`player-spin:${ip}`, env.SPIN_RATE_LIMIT_PER_MINUTE, 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "public player spin"
    });

    if (!limited.allowed) {
      return jsonError("Too many requests. Please try again shortly.", 429);
    }

    const parsed = spinSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid participant list.", 400);
    }

    const result = await createPublicPlayerSpin({ participants: parsed.data.participants });

    return NextResponse.json({
      spinId: result.spinId,
      participantId: result.participantId,
      displayName: result.displayName,
      reference: result.reference,
      eligibleCount: result.eligibleCount,
      timestamp: result.timestamp
    });
  } catch (error) {
    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Public player spin error", error);
    return jsonError("Player draw is unavailable right now. Please try again shortly.", 500);
  }
}
