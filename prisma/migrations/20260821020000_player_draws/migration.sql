CREATE TABLE "PlayerDraw" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Lucky Player Draw',
  "mode" TEXT NOT NULL DEFAULT 'RANDOM',
  "pendingOperatorParticipantId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "removeWinnerAfterWin" BOOLEAN NOT NULL DEFAULT false,
  "showParticipantList" BOOLEAN NOT NULL DEFAULT true,
  "showReferencesPublicly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlayerDraw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerParticipant" (
  "id" TEXT NOT NULL,
  "playerDrawId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "reference" TEXT,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlayerParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerDrawResult" (
  "id" TEXT NOT NULL,
  "playerDrawId" TEXT NOT NULL,
  "participantId" TEXT,
  "displayNameSnapshot" TEXT NOT NULL,
  "referenceSnapshot" TEXT,
  "mode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlayerDrawResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerDraw_publicCode_key" ON "PlayerDraw"("publicCode");
CREATE INDEX "PlayerDraw_publicCode_idx" ON "PlayerDraw"("publicCode");
CREATE INDEX "PlayerDraw_isActive_idx" ON "PlayerDraw"("isActive");
CREATE INDEX "PlayerDraw_pendingOperatorParticipantId_idx" ON "PlayerDraw"("pendingOperatorParticipantId");
CREATE INDEX "PlayerParticipant_playerDrawId_idx" ON "PlayerParticipant"("playerDrawId");
CREATE INDEX "PlayerParticipant_isEligible_idx" ON "PlayerParticipant"("isEligible");
CREATE INDEX "PlayerDrawResult_playerDrawId_idx" ON "PlayerDrawResult"("playerDrawId");
CREATE INDEX "PlayerDrawResult_participantId_idx" ON "PlayerDrawResult"("participantId");
CREATE INDEX "PlayerDrawResult_createdAt_idx" ON "PlayerDrawResult"("createdAt");

ALTER TABLE "PlayerDraw"
  ADD CONSTRAINT "PlayerDraw_pendingOperatorParticipantId_fkey"
  FOREIGN KEY ("pendingOperatorParticipantId") REFERENCES "PlayerParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlayerParticipant"
  ADD CONSTRAINT "PlayerParticipant_playerDrawId_fkey"
  FOREIGN KEY ("playerDrawId") REFERENCES "PlayerDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerDrawResult"
  ADD CONSTRAINT "PlayerDrawResult_playerDrawId_fkey"
  FOREIGN KEY ("playerDrawId") REFERENCES "PlayerDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerDrawResult"
  ADD CONSTRAINT "PlayerDrawResult_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "PlayerParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
