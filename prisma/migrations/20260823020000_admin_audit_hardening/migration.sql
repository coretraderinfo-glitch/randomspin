ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AuditLog" ADD COLUMN "clientIpHash" TEXT;

CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
