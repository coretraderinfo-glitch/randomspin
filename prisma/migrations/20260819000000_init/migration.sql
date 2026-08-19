CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tokenHash" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WheelConfiguration" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL DEFAULT 'Default Wheel',
  "minNumber" INTEGER NOT NULL DEFAULT 1,
  "maxNumber" INTEGER NOT NULL DEFAULT 30,
  "excludedNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WheelConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpinResult" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "wheelConfigurationId" TEXT NOT NULL,
  "requestedMin" INTEGER NOT NULL,
  "requestedMax" INTEGER NOT NULL,
  "winningNumber" INTEGER NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "hashedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpinResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSettings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "siteName" TEXT NOT NULL DEFAULT 'Lucky Spin',
  "headline" TEXT NOT NULL DEFAULT 'SPIN YOUR LUCK',
  "subtitle" TEXT NOT NULL DEFAULT 'Let the wheel choose.',
  "announcement" TEXT,
  "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "confettiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "recentResultCount" INTEGER NOT NULL DEFAULT 10,
  "defaultFrom" INTEGER NOT NULL DEFAULT 1,
  "defaultTo" INTEGER NOT NULL DEFAULT 30,
  "maximumAllowedRange" INTEGER NOT NULL DEFAULT 1000,
  "publicDisclosureMessage" TEXT NOT NULL DEFAULT 'Results are selected from the configured eligible number pool.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "adminUserId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX "SpinResult_createdAt_idx" ON "SpinResult"("createdAt");
CREATE INDEX "SpinResult_winningNumber_idx" ON "SpinResult"("winningNumber");
CREATE INDEX "SpinResult_requestedMin_requestedMax_idx" ON "SpinResult"("requestedMin", "requestedMax");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_adminUserId_idx" ON "AuditLog"("adminUserId");

ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpinResult" ADD CONSTRAINT "SpinResult_wheelConfigurationId_fkey"
  FOREIGN KEY ("wheelConfigurationId") REFERENCES "WheelConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
