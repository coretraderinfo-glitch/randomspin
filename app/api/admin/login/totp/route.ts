import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { decryptTotpSecret, verifyTotpCode } from "@/lib/admin-totp";
import {
  createAdminSession,
  getAdminTwoFactorChallenge,
  markAdminTwoFactorChallengeUsed,
  setAdminCookie
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const totpLoginSchema = z.object({
  challengeToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: NextRequest) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const ip = getClientIp(request);
    const limited = await rateLimit(`admin-totp-login:${ip}`, env.ADMIN_TOTP_RATE_LIMIT_PER_MINUTE, 60_000);
    if (!limited.allowed) {
      return jsonError("Too many attempts. Please try again shortly.", 429);
    }

    const parsed = totpLoginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid verification code.", 400);
    }

    const challenge = await getAdminTwoFactorChallenge(parsed.data.challengeToken);
    if (!challenge?.adminUser.totpEnabled || !challenge.adminUser.totpSecretEncrypted) {
      await logAdminAudit({
        action: "ADMIN_TOTP_LOGIN_FAILED",
        target: "AdminUser",
        success: false,
        request
      });
      return jsonError("Invalid verification code.", 401);
    }

    const verified = verifyTotpCode(decryptTotpSecret(challenge.adminUser.totpSecretEncrypted), parsed.data.code, {
      lastUsedStep: challenge.adminUser.totpLastUsedStep
    });
    if (!verified) {
      await logAdminAudit({
        adminUserId: challenge.adminUser.id,
        action: "ADMIN_TOTP_LOGIN_FAILED",
        target: `AdminUser:${challenge.adminUser.id}`,
        success: false,
        request
      });
      return jsonError("Invalid verification code.", 401);
    }

    const consumed = await markAdminTwoFactorChallengeUsed(challenge.id);
    if (consumed.count !== 1) {
      return jsonError("Invalid verification code.", 401);
    }

    const stepClaimed = await prisma.adminUser.updateMany({
      where: {
        id: challenge.adminUser.id,
        OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: verified.step } }]
      },
      data: { totpLastUsedStep: verified.step }
    });
    if (stepClaimed.count !== 1) {
      await logAdminAudit({
        adminUserId: challenge.adminUser.id,
        action: "ADMIN_TOTP_LOGIN_FAILED",
        target: `AdminUser:${challenge.adminUser.id}`,
        success: false,
        request
      });
      return jsonError("Invalid verification code.", 401);
    }

    const { token, expiresAt } = await createAdminSession(challenge.adminUser.id);
    await logAdminAudit({
      adminUserId: challenge.adminUser.id,
      action: "ADMIN_TOTP_LOGIN_SUCCEEDED",
      target: `AdminUser:${challenge.adminUser.id}`,
      request
    });

    const response = NextResponse.json({ ok: true });
    setAdminCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    console.error("Admin TOTP login error", error);
    return jsonError("Two-factor login is unavailable right now.", 500);
  }
}
