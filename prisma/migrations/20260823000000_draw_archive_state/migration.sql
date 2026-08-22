ALTER TABLE "PrivateDraw" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "PlayerDraw" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "PrivateDraw_archivedAt_idx" ON "PrivateDraw"("archivedAt");
CREATE INDEX "PlayerDraw_archivedAt_idx" ON "PlayerDraw"("archivedAt");
