import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(rootDir, "prisma", "dev.db");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" DATETIME
);

CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "adminUserId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  CONSTRAINT "AdminSession_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WheelConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT 'Default Wheel',
  "minNumber" INTEGER NOT NULL DEFAULT 1,
  "maxNumber" INTEGER NOT NULL DEFAULT 30,
  "excludedNumbers" TEXT NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PrivateDraw" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicCode" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL DEFAULT 'Private Draw',
  "minNumber" INTEGER NOT NULL DEFAULT 1,
  "maxNumber" INTEGER NOT NULL DEFAULT 30,
  "excludedNumbers" TEXT NOT NULL DEFAULT '[]',
  "mode" TEXT NOT NULL DEFAULT 'RANDOM',
  "displayStyle" TEXT NOT NULL DEFAULT 'WHEEL',
  "pendingOperatorWinner" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SpinResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "wheelConfigurationId" TEXT NOT NULL,
  "requestedMin" INTEGER NOT NULL,
  "requestedMax" INTEGER NOT NULL,
  "winningNumber" INTEGER NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "hashedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpinResult_wheelConfigurationId_fkey"
    FOREIGN KEY ("wheelConfigurationId") REFERENCES "WheelConfiguration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PrivateDrawSpinResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "privateDrawId" TEXT NOT NULL,
  "requestedMin" INTEGER NOT NULL,
  "requestedMax" INTEGER NOT NULL,
  "winningNumber" INTEGER NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "hashedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateDrawSpinResult_privateDrawId_fkey"
    FOREIGN KEY ("privateDrawId") REFERENCES "PrivateDraw" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayerDraw" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicCode" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL DEFAULT 'Player Draw',
  "mode" TEXT NOT NULL DEFAULT 'RANDOM',
  "pendingOperatorParticipantId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" DATETIME,
  "removeWinnerAfterWin" BOOLEAN NOT NULL DEFAULT false,
  "showParticipantList" BOOLEAN NOT NULL DEFAULT true,
  "showReferencesPublicly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerDraw_pendingOperatorParticipantId_fkey"
    FOREIGN KEY ("pendingOperatorParticipantId") REFERENCES "PlayerParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayerParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerDrawId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "reference" TEXT,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerParticipant_playerDrawId_fkey"
    FOREIGN KEY ("playerDrawId") REFERENCES "PlayerDraw" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayerDrawResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerDrawId" TEXT NOT NULL,
  "participantId" TEXT,
  "displayNameSnapshot" TEXT NOT NULL,
  "referenceSnapshot" TEXT,
  "mode" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerDrawResult_playerDrawId_fkey"
    FOREIGN KEY ("playerDrawId") REFERENCES "PlayerDraw" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerDrawResult_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "PlayerParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SiteSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "siteName" TEXT NOT NULL DEFAULT 'RandomSpin',
  "headline" TEXT NOT NULL DEFAULT 'RandomSpin',
  "subtitle" TEXT NOT NULL DEFAULT 'Free random draws for names, numbers, and more.',
  "announcement" TEXT,
  "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "confettiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "recentResultCount" INTEGER NOT NULL DEFAULT 10,
  "defaultFrom" INTEGER NOT NULL DEFAULT 1,
  "defaultTo" INTEGER NOT NULL DEFAULT 30,
  "maximumAllowedRange" INTEGER NOT NULL DEFAULT 1000,
  "publicDisclosureMessage" TEXT NOT NULL DEFAULT 'Results are selected from the configured eligible pool.',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  "contactEmail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "adminUserId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_idx" ON "AdminSession" ("adminUserId");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession" ("expiresAt");
CREATE INDEX IF NOT EXISTS "PrivateDraw_publicCode_idx" ON "PrivateDraw" ("publicCode");
CREATE INDEX IF NOT EXISTS "PrivateDraw_isActive_idx" ON "PrivateDraw" ("isActive");
CREATE INDEX IF NOT EXISTS "SpinResult_createdAt_idx" ON "SpinResult" ("createdAt");
CREATE INDEX IF NOT EXISTS "SpinResult_winningNumber_idx" ON "SpinResult" ("winningNumber");
CREATE INDEX IF NOT EXISTS "SpinResult_requestedMin_requestedMax_idx" ON "SpinResult" ("requestedMin", "requestedMax");
CREATE INDEX IF NOT EXISTS "PrivateDrawSpinResult_privateDrawId_idx" ON "PrivateDrawSpinResult" ("privateDrawId");
CREATE INDEX IF NOT EXISTS "PrivateDrawSpinResult_createdAt_idx" ON "PrivateDrawSpinResult" ("createdAt");
CREATE INDEX IF NOT EXISTS "PrivateDrawSpinResult_winningNumber_idx" ON "PrivateDrawSpinResult" ("winningNumber");
CREATE INDEX IF NOT EXISTS "PlayerDraw_publicCode_idx" ON "PlayerDraw" ("publicCode");
CREATE INDEX IF NOT EXISTS "PlayerDraw_isActive_idx" ON "PlayerDraw" ("isActive");
CREATE INDEX IF NOT EXISTS "PlayerDraw_pendingOperatorParticipantId_idx" ON "PlayerDraw" ("pendingOperatorParticipantId");
CREATE INDEX IF NOT EXISTS "PlayerParticipant_playerDrawId_idx" ON "PlayerParticipant" ("playerDrawId");
CREATE INDEX IF NOT EXISTS "PlayerParticipant_isEligible_idx" ON "PlayerParticipant" ("isEligible");
CREATE INDEX IF NOT EXISTS "PlayerDrawResult_playerDrawId_idx" ON "PlayerDrawResult" ("playerDrawId");
CREATE INDEX IF NOT EXISTS "PlayerDrawResult_participantId_idx" ON "PlayerDrawResult" ("participantId");
CREATE INDEX IF NOT EXISTS "PlayerDrawResult_createdAt_idx" ON "PlayerDrawResult" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_adminUserId_idx" ON "AuditLog" ("adminUserId");
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  }
}

ensureColumn("PrivateDraw", "displayStyle", "TEXT NOT NULL DEFAULT 'WHEEL'");
ensureColumn("PrivateDraw", "archivedAt", "DATETIME");
ensureColumn("PlayerDraw", "archivedAt", "DATETIME");

db.exec(`
CREATE INDEX IF NOT EXISTS "PrivateDraw_archivedAt_idx" ON "PrivateDraw" ("archivedAt");
CREATE INDEX IF NOT EXISTS "PlayerDraw_archivedAt_idx" ON "PlayerDraw" ("archivedAt");
`);

db.prepare(`
  INSERT OR IGNORE INTO "SiteSettings" (
    "id",
    "siteName",
    "headline",
    "subtitle",
    "publicDisclosureMessage",
    "updatedAt"
  )
  VALUES (
    'default',
    'RandomSpin',
    'RandomSpin',
    'Free random draws for names, numbers, and more.',
    'Results are selected from the configured eligible pool.',
    CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  UPDATE "SiteSettings"
  SET
    "siteName" = 'RandomSpin',
    "headline" = 'RandomSpin',
    "subtitle" = 'Free random draws for names, numbers, and more.',
    "publicDisclosureMessage" = 'Results are selected from the configured eligible pool.',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'default'
    AND "siteName" = 'Lucky Spin'
    AND "headline" = 'SPIN YOUR LUCK'
`).run();

db.prepare(`
  INSERT OR IGNORE INTO "PrivateDraw" (
    "id",
    "publicCode",
    "name",
    "minNumber",
    "maxNumber",
    "excludedNumbers",
    "mode",
    "displayStyle",
    "isActive",
    "updatedAt"
  )
  VALUES ('local-event-draw', 'A7K29P', 'Local Event Draw', 1, 30, '[]', 'RANDOM', 'WHEEL', true, CURRENT_TIMESTAMP)
`).run();

db.prepare(`
  INSERT OR IGNORE INTO "PlayerDraw" (
    "id",
    "publicCode",
    "name",
    "mode",
    "isActive",
    "removeWinnerAfterWin",
    "showParticipantList",
    "showReferencesPublicly",
    "updatedAt"
  )
  VALUES ('local-player-test', 'PLAYTEST', 'Local RandomSpin Player Test', 'RANDOM', true, false, true, true, CURRENT_TIMESTAMP)
`).run();

db.prepare(`
  UPDATE "PlayerDraw"
  SET "name" = 'Local RandomSpin Player Test', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'local-player-test'
    AND "name" = 'Local Lucky Player Test'
`).run();

for (const [index, name] of ["Ali", "Jason", "Sarah", "David", "Wendy", "James", "Michelle", "Kevin", "Amanda", "Daniel"].entries()) {
  db.prepare(`
    INSERT OR IGNORE INTO "PlayerParticipant" (
      "id",
      "playerDrawId",
      "displayName",
      "reference",
      "isEligible",
      "updatedAt"
    )
    VALUES (?, 'local-player-test', ?, ?, true, CURRENT_TIMESTAMP)
  `).run(`local-player-${index + 1}`, name, String(index + 1).padStart(3, "0"));
}

db.close();

console.log(`Local SQLite database ready at ${dbPath}`);
