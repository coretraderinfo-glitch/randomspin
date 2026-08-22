ALTER TABLE "PrivateDraw" ADD COLUMN "liveSlug" TEXT;

CREATE UNIQUE INDEX "PrivateDraw_liveSlug_key" ON "PrivateDraw"("liveSlug");
CREATE INDEX "PrivateDraw_liveSlug_idx" ON "PrivateDraw"("liveSlug");
