import bcrypt from "bcryptjs";
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

const disableSchema = z.object({
  password: z.string().min(1),
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

    const limited = await rateLimit(`admin-totp-disable:${admin.id}:${getClientIp(request)}`, env.ADMIN_TOTP_RATE_LIMIT_PER_MINUTE, 60_000);
    if (!limited.allowed) {
      return jsonError("Too many attempts. Please try again shortly.", 429);
    }

    const parsed = disableSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid request.", 400);
    }

    const freshAdmin = await prisma.adminUser.findUnique({ where: { id: admin.id } });
    if (
      !freshAdmin?.totpEnabled ||
      !freshAdmin.totpSecretEncrypted ||
      !(await bcrypt.compare(parsed.data.password, freshAdmin.passwordHash))
    ) {
      return jsonError("Invalid credentials.", 401);
    }

    const verified = verifyTotpCode(decryptTotpSecret(freshAdmin.totpSecretEncrypted), parsed.data.code);
    if (!verified) {
      return jsonError("Invalid credentials.", 401);
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        totpEnabled: false,
        totpSecretEncrypted: null,
        totpSetupSecretEncrypted: null,
        totpSetupStartedAt: null,
        totpVerifiedAt: null,
        totpLastUsedStep: null
      }
    });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "ADMIN_TOTP_DISABLED",
      target: `AdminUser:${admin.id}`,
      request
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin TOTP disable error", error);
    return jsonError("Two-factor disable is unavailable right now.", 500);
  }
}
