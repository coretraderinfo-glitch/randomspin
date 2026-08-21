import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { PlayerDrawNotFoundError, createPrivatePlayerDrawSpin } from "@/lib/player-draws";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, jsonError, sanitizeUserAgent } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicCode: string }> }) {
  try {
    await request.json().catch(() => null);
    const { publicCode } = await params;
    const ip = getClientIp(request);
    const limited = await rateLimit(`player-draw:${publicCode}:${ip}`, env.SPIN_RATE_LIMIT_PER_MINUTE, 60_000);

    if (!limited.allowed) {
      return jsonError("Too many requests. Please try again shortly.", 429);
    }

    const result = await createPrivatePlayerDrawSpin({
      publicCode,
      hashedIp: hashIp(ip),
      userAgent: sanitizeUserAgent(request.headers.get("user-agent"))
    });

    return NextResponse.json({
      spinId: result.spinId,
      participantId: result.participantId,
      displayName: result.displayName,
      reference: result.reference,
      eligibleCount: result.eligibleCount,
      timestamp: result.timestamp
    });
  } catch (error) {
    if (error instanceof PlayerDrawNotFoundError) {
      return jsonError("Player draw not found.", 404);
    }

    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Private player draw spin error", error);
    return jsonError("Player draw is unavailable right now. Please try again shortly.", 500);
  }
}
