ALTER TABLE "AdminUser" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN "totpSecretEncrypted" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "totpSetupSecretEncrypted" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "totpSetupStartedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "totpVerifiedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "totpLastUsedStep" INTEGER;

CREATE TABLE "AdminTwoFactorChallenge" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),

  CONSTRAINT "AdminTwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTwoFactorChallenge_tokenHash_key" ON "AdminTwoFactorChallenge"("tokenHash");
CREATE INDEX "AdminTwoFactorChallenge_adminUserId_idx" ON "AdminTwoFactorChallenge"("adminUserId");
CREATE INDEX "AdminTwoFactorChallenge_expiresAt_idx" ON "AdminTwoFactorChallenge"("expiresAt");

ALTER TABLE "AdminTwoFactorChallenge"
  ADD CONSTRAINT "AdminTwoFactorChallenge_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
