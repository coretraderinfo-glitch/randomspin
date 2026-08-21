import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFromRequest } from "@/lib/auth";
import { serializeAuditMetadata } from "@/lib/audit-metadata";
import { prisma } from "@/lib/db";
import { normalizeExcludedNumbers, serializeExcludedNumbers } from "@/lib/excluded-numbers";
import { jsonError, requireSameOrigin } from "@/lib/security";
import { parseExcludedNumbers, SpinValidationError } from "@/lib/spin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const wheelUpdateSchema = z.object({
  minNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  maxNumber: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  excludedNumbers: z.array(z.number().int()).max(1000).optional(),
  excludedText: z.string().optional()
});

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  const config = await prisma.wheelConfiguration.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({
    config: config
      ? {
          ...config,
          excludedNumbers: normalizeExcludedNumbers(config.excludedNumbers)
        }
      : null
  });
}

export async function PUT(request: NextRequest) {
  try {
    if (!requireSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized.", 401);
    }

    const parsed = wheelUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid wheel configuration.", 400);
    }

    const { minNumber, maxNumber } = parsed.data;
    if (minNumber >= maxNumber) {
      return jsonError("Minimum number must be lower than maximum number.", 400);
    }

    if (maxNumber - minNumber + 1 > 1000) {
      return jsonError("The active wheel range can include at most 1,000 numbers.", 400);
    }

    const excludedNumbers =
      parsed.data.excludedText !== undefined
        ? parseExcludedNumbers(parsed.data.excludedText, minNumber, maxNumber)
        : Array.from(new Set(parsed.data.excludedNumbers ?? [])).sort((a, b) => a - b);

    if (excludedNumbers.some((value) => value < minNumber || value > maxNumber)) {
      return jsonError("Excluded numbers must stay inside the active range.", 400);
    }

    const current = await prisma.wheelConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    const updated = await prisma.wheelConfiguration.upsert({
      where: { id: current?.id ?? "default" },
      update: { minNumber, maxNumber, excludedNumbers: serializeExcludedNumbers(excludedNumbers) },
      create: {
        id: "default",
        name: "Default Wheel",
        minNumber,
        maxNumber,
        excludedNumbers: serializeExcludedNumbers(excludedNumbers)
      }
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: admin.id,
        action: "WHEEL_CONFIGURATION_UPDATED",
        target: "WheelConfiguration",
        metadata: serializeAuditMetadata({
          previous: current
            ? {
                minNumber: current.minNumber,
                maxNumber: current.maxNumber,
                excludedNumbers: normalizeExcludedNumbers(current.excludedNumbers)
              }
            : null,
          next: { minNumber, maxNumber, excludedNumbers }
        })
      }
    });

    return NextResponse.json({
      config: {
        ...updated,
        excludedNumbers: normalizeExcludedNumbers(updated.excludedNumbers)
      },
      message: "Wheel configuration updated successfully."
    });
  } catch (error) {
    if (error instanceof SpinValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Wheel admin error", error);
    return jsonError("Wheel settings could not be saved.", 500);
  }
}
