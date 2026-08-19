import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { isValidTimeZone } from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  siteName: z.string().min(1).max(80),
  headline: z.string().min(1).max(100),
  subtitle: z.string().min(1).max(180),
  announcement: z.string().max(240).nullable().optional(),
  soundEnabled: z.boolean(),
  confettiEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  recentResultCount: z.number().int().min(1).max(20),
  defaultFrom: z.number().int(),
  defaultTo: z.number().int(),
  maximumAllowedRange: z.number().int().min(2).max(1000),
  publicDisclosureMessage: z.string().min(1).max(220),
  timezone: z.string().min(1).max(80),
  contactEmail: z.string().email().nullable().optional()
});

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid website settings.", 400);
  }

  if (parsed.data.defaultFrom >= parsed.data.defaultTo) {
    return jsonError("Default FROM must be lower than default TO.", 400);
  }

  if (!isValidTimeZone(parsed.data.timezone)) {
    return jsonError("Use a valid IANA timezone name.", 400);
  }

  const previous = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  const settings = await prisma.siteSettings.update({
    where: { id: "default" },
    data: parsed.data
  });

  await prisma.auditLog.create({
    data: {
      adminUserId: admin.id,
      action: "SITE_SETTINGS_UPDATED",
      target: "SiteSettings",
      metadata: { previous, next: settings }
    }
  });

  return NextResponse.json({ settings, message: "Website settings saved." });
}
