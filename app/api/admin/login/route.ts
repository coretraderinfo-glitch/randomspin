import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { createAdminSession, createAdminTwoFactorChallenge, setAdminCookie, verifyAdminCredentials } from "@/lib/auth";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, jsonError, requireSameOrigin, sha256 } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const ip = getClientIp(request);
    const limited = await rateLimit(`admin-login:${ip}`, env.ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE, 60_000);
    if (!limited.allowed) {
      return jsonError("Too many requests. Please try again shortly.", 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Enter a valid email and password.", 400);
    }

    const admin = await verifyAdminCredentials(parsed.data.email, parsed.data.password);
    if (!admin) {
      await logAdminAudit({
        action: "ADMIN_LOGIN_FAILED",
        target: "AdminUser",
        success: false,
        request,
        metadata: { emailHash: sha256(parsed.data.email.toLowerCase()) }
      });
      return jsonError("Invalid email or password.", 401);
    }

    if (admin.totpEnabled) {
      const challenge = await createAdminTwoFactorChallenge(admin.id);
      return NextResponse.json({ requiresTwoFactor: true, challengeToken: challenge.token });
    }

    const { token, expiresAt } = await createAdminSession(admin.id);
    await logAdminAudit({
      adminUserId: admin.id,
      action: "ADMIN_LOGIN_SUCCEEDED",
      target: `AdminUser:${admin.id}`,
      request
    });
    const response = NextResponse.json({ ok: true });
    setAdminCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    console.error("Admin login error", error);
    return jsonError("Login is unavailable right now.", 500);
  }
}
