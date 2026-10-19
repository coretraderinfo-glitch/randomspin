import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedisRateLimitHealthState } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const redisRateLimit = getRedisRateLimitHealthState();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "lucky-spin",
      database: "ok",
      redisRateLimit
    });
  } catch {
    console.error("Health check database query failed.");

    return NextResponse.json(
      {
        ok: false,
        service: "lucky-spin",
        database: "unavailable",
        redisRateLimit
      },
      { status: 503 }
    );
  }
}
