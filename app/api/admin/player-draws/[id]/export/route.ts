import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { exportParticipantsCsv, getPlayerDrawForAdmin } from "@/lib/player-draws";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await params;
  const draw = await getPlayerDrawForAdmin(id);
  if (!draw) {
    return jsonError("Player draw not found.", 404);
  }

  return new NextResponse(exportParticipantsCsv(draw.participants), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${draw.publicCode}-participants.csv"`
    }
  });
}
