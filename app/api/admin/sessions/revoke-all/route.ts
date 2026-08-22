import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminFromRequest, revokeAllAdminSessions } from "@/lib/auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const result = await revokeAllAdminSessions(admin.id);
  await logAdminAudit({
    adminUserId: admin.id,
    action: "ADMIN_SESSIONS_REVOKED",
    target: `AdminUser:${admin.id}`,
    request,
    metadata: { revokedCount: result.count }
  });

  const response = NextResponse.json({ ok: true, revokedCount: result.count });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
