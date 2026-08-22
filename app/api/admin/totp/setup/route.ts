import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAudit } from "@/lib/admin-audit";
import { createTotpQrDataUrl, encryptTotpSecret, generateTotpSecret } from "@/lib/admin-totp";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setupSchema = z.object({
  password: z.string().min(1)
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

    const parsed = setupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid request.", 400);
    }

    const freshAdmin = await prisma.adminUser.findUnique({ where: { id: admin.id } });
    if (!freshAdmin || !(await bcrypt.compare(parsed.data.password, freshAdmin.passwordHash))) {
      return jsonError("Invalid credentials.", 401);
    }

    const secret = generateTotpSecret();
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        totpSetupSecretEncrypted: encryptTotpSecret(secret),
        totpSetupStartedAt: new Date()
      }
    });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "ADMIN_TOTP_SETUP_STARTED",
      target: `AdminUser:${admin.id}`,
      request
    });

    return NextResponse.json({
      manualKey: secret,
      qrCodeDataUrl: await createTotpQrDataUrl({ email: freshAdmin.email, secret })
    });
  } catch (error) {
    console.error("Admin TOTP setup error", error);
    return jsonError("Two-factor setup is unavailable right now.", 500);
  }
}
