import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, revokeCurrentSession } from "@/lib/auth";
import { jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  await revokeCurrentSession(request);
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
