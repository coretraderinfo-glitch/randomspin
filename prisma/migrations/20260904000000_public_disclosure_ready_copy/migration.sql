ALTER TABLE "SiteSettings" ALTER COLUMN "publicDisclosureMessage" SET DEFAULT 'Ready for the next draw.';

UPDATE "SiteSettings"
SET "publicDisclosureMessage" = 'Ready for the next draw.'
WHERE "id" = 'default'
  AND "publicDisclosureMessage" = 'Results are selected from the configured eligible pool.';
