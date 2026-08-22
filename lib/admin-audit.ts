import "server-only";
import { NextRequest } from "next/server";
import { serializeAuditMetadata } from "@/lib/audit-metadata";
import { prisma } from "@/lib/db";
import { getClientIp, hashIp } from "@/lib/security";

type AdminAuditInput = {
  adminUserId?: string | null;
  action: string;
  target: string;
  success?: boolean;
  request?: NextRequest;
  metadata?: Record<string, unknown> | null;
};

export async function logAdminAudit({ adminUserId, action, target, success = true, request, metadata }: AdminAuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: adminUserId ?? null,
        action,
        target,
        success,
        clientIpHash: request ? hashIp(getClientIp(request)) : null,
        metadata: metadata ? serializeAuditMetadata(metadata) : undefined
      }
    });
  } catch (error) {
    console.error("Admin audit log error", error);
  }
}
