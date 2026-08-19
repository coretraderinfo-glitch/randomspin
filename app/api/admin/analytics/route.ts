import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const today = startOfDay();
  const week = new Date(today);
  week.setDate(week.getDate() - 6);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayCount, weekCount, monthCount, total, winners, ranges, latest] = await Promise.all([
    prisma.spinResult.count({ where: { createdAt: { gte: today } } }),
    prisma.spinResult.count({ where: { createdAt: { gte: week } } }),
    prisma.spinResult.count({ where: { createdAt: { gte: month } } }),
    prisma.spinResult.count(),
    prisma.spinResult.groupBy({
      by: ["winningNumber"],
      _count: { winningNumber: true },
      orderBy: { _count: { winningNumber: "desc" } },
      take: 8
    }),
    prisma.spinResult.groupBy({
      by: ["requestedMin", "requestedMax"],
      _count: { requestedMin: true },
      orderBy: { _count: { requestedMin: "desc" } },
      take: 8
    }),
    prisma.spinResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { createdAt: true }
    })
  ]);

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    label: `${hour}:00`,
    value: latest.filter((spin) => spin.createdAt.getHours() === hour).length
  }));

  return NextResponse.json({
    cards: { todayCount, weekCount, monthCount, total },
    winners: winners.map((item) => ({
      label: String(item.winningNumber),
      value: item._count.winningNumber
    })),
    ranges: ranges.map((item) => ({
      label: `${item.requestedMin}-${item.requestedMax}`,
      value: item._count.requestedMin
    })),
    hourly
  });
}
