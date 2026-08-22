import { NextRequest, NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { ADMIN_SESSION_COOKIE, getAdminFromRequest, revokeCurrentSession } from "@/lib/auth";
import { jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const admin = await getAdminFromRequest(request);
  await revokeCurrentSession(request);
  await logAdminAudit({
    adminUserId: admin?.id,
    action: "ADMIN_LOGOUT",
    target: admin ? `AdminUser:${admin.id}` : "AdminUser",
    request
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
