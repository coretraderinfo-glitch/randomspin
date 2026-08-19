import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { env, isDatabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, jsonError, sanitizeUserAgent } from "@/lib/security";
import { getActiveWheelConfiguration, getSiteSettings } from "@/lib/public-data";
import { selectSecureWinner, spinRequestSchema, SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`spin:${ip}`, env.SPIN_RATE_LIMIT_PER_MINUTE, 60_000);

    if (!limited.allowed) {
      return jsonError("Too many requests. Please try again shortly.", 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = spinRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Please enter a valid number range.", 400);
    }

    const [config, settings] = await Promise.all([getActiveWheelConfiguration(), getSiteSettings()]);

    if (settings.maintenanceMode) {
      return jsonError("Lucky Spin is temporarily unavailable.", 503);
    }

    const selection = selectSecureWinner(parsed.data.from, parsed.data.to, {
      configMin: config.minNumber,
      configMax: config.maxNumber,
      excludedNumbers: config.excludedNumbers,
      maximumAllowedRange: settings.maximumAllowedRange
    });

    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        spinId: `local-${randomUUID()}`,
        winner: selection.winner,
        timestamp: new Date().toISOString()
      });
    }

    const result = await prisma.spinResult.create({
      data: {
        wheelConfigurationId: config.id,
        requestedMin: selection.requestedMin,
        requestedMax: selection.requestedMax,
        winningNumber: selection.winner,
        eligibleCount: selection.eligiblePool.length,
        hashedIp: hashIp(ip),
        userAgent: sanitizeUserAgent(request.headers.get("user-agent"))
      }
    });

    return NextResponse.json({
      spinId: result.id,
      winner: result.winningNumber,
      timestamp: result.createdAt.toISOString()
    });
  } catch (error) {
    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Spin API error", error);
    return jsonError("Spin is unavailable right now. Please try again shortly.", 500);
  }
}
