ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
