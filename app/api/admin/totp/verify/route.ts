import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { decryptTotpSecret, verifyTotpCode } from "@/lib/admin-totp";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: NextRequest) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const limited = await rateLimit(`admin-totp-setup:${admin.id}:${getClientIp(request)}`, env.ADMIN_TOTP_RATE_LIMIT_PER_MINUTE, 60_000);
    if (!limited.allowed) {
      return jsonError("Too many attempts. Please try again shortly.", 429);
    }

    const parsed = verifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid verification code.", 400);
    }

    const freshAdmin = await prisma.adminUser.findUnique({ where: { id: admin.id } });
    if (!freshAdmin?.totpSetupSecretEncrypted) {
      return jsonError("Two-factor setup has not been started.", 400);
    }

    const secret = decryptTotpSecret(freshAdmin.totpSetupSecretEncrypted);
    const verified = verifyTotpCode(secret, parsed.data.code);
    if (!verified) {
      return jsonError("Invalid verification code.", 400);
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        totpEnabled: true,
        totpSecretEncrypted: freshAdmin.totpSetupSecretEncrypted,
        totpSetupSecretEncrypted: null,
        totpSetupStartedAt: null,
        totpVerifiedAt: new Date(),
        totpLastUsedStep: verified.step
      }
    });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "ADMIN_TOTP_ENABLED",
      target: `AdminUser:${admin.id}`,
      request
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin TOTP verify error", error);
    return jsonError("Two-factor verification is unavailable right now.", 500);
  }
}
