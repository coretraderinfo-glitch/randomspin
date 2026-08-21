CREATE TABLE "PrivateDraw" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Private Draw',
  "minNumber" INTEGER NOT NULL DEFAULT 1,
  "maxNumber" INTEGER NOT NULL DEFAULT 30,
  "excludedNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "mode" TEXT NOT NULL DEFAULT 'RANDOM',
  "pendingOperatorWinner" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateDraw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivateDrawSpinResult" (
  "id" TEXT NOT NULL,
  "privateDrawId" TEXT NOT NULL,
  "requestedMin" INTEGER NOT NULL,
  "requestedMax" INTEGER NOT NULL,
  "winningNumber" INTEGER NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "hashedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateDrawSpinResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateDraw_publicCode_key" ON "PrivateDraw"("publicCode");
CREATE INDEX "PrivateDraw_publicCode_idx" ON "PrivateDraw"("publicCode");
CREATE INDEX "PrivateDraw_isActive_idx" ON "PrivateDraw"("isActive");
CREATE INDEX "PrivateDrawSpinResult_privateDrawId_idx" ON "PrivateDrawSpinResult"("privateDrawId");
CREATE INDEX "PrivateDrawSpinResult_createdAt_idx" ON "PrivateDrawSpinResult"("createdAt");
CREATE INDEX "PrivateDrawSpinResult_winningNumber_idx" ON "PrivateDrawSpinResult"("winningNumber");

ALTER TABLE "PrivateDrawSpinResult"
  ADD CONSTRAINT "PrivateDrawSpinResult_privateDrawId_fkey"
  FOREIGN KEY ("privateDrawId") REFERENCES "PrivateDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
