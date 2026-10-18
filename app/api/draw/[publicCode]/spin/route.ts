import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { PrivateDrawNotFoundError, createPrivateDrawSpin, getPrivateDrawAudience } from "@/lib/private-draws";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, jsonError, sanitizeUserAgent } from "@/lib/security";
import { SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicCode: string }> }) {
  try {
    const { publicCode } = await params;
    const draw = await getPrivateDrawAudience(publicCode);

    if (!draw) {
      return jsonError("Draw not found.", 404);
    }

    return NextResponse.json({
      from: draw.minNumber,
      to: draw.maxNumber,
      label: draw.label,
      displayStyle: draw.displayStyle,
      revision: draw.revision
    });
  } catch (error) {
    console.error("Private draw state error", error);
    return jsonError("Draw is unavailable right now. Please try again shortly.", 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicCode: string }> }) {
  try {
    await request.json().catch(() => null);
    const { publicCode } = await params;
    const ip = getClientIp(request);
    const limited = await rateLimit(`draw-spin:${publicCode}:${ip}`, env.SPIN_RATE_LIMIT_PER_MINUTE, 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "private number spin"
    });

    if (!limited.allowed) {
      return jsonError("Too many requests. Please try again shortly.", 429);
    }

    const result = await createPrivateDrawSpin({
      publicCode,
      hashedIp: hashIp(ip),
      userAgent: sanitizeUserAgent(request.headers.get("user-agent"))
    });

    return NextResponse.json({
      spinId: result.spinId,
      winner: result.winner,
      timestamp: result.timestamp,
      from: result.from,
      to: result.to,
      mode: result.mode,
      nextLabel: result.nextLabel
    });
  } catch (error) {
    if (error instanceof PrivateDrawNotFoundError) {
      return jsonError("Draw not found.", 404);
    }

    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Private draw spin error", error);
    return jsonError("Draw is unavailable right now. Please try again shortly.", 500);
  }
}
