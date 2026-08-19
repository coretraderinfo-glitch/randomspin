import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const winner = Number(searchParams.get("winner") ?? "");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const take = 25;

  const where = {
    ...(Number.isInteger(winner) ? { winningNumber: winner } : {}),
    ...(from ? { requestedMin: { gte: Number(from) } } : {}),
    ...(to ? { requestedMax: { lte: Number(to) } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.spinResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take
    }),
    prisma.spinResult.count({ where })
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageCount: Math.ceil(total / take)
  });
}
