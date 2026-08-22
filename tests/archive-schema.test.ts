import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("draw archive and delete schema safety", () => {
  it("uses explicit archive state without replacing active state", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("model PrivateDraw");
    expect(schema).toContain("model PlayerDraw");
    expect(schema).toContain("archivedAt            DateTime?");
    expect(schema).toContain("@@index([archivedAt])");
    expect(schema).toContain("isActive              Boolean");
    expect(schema).toContain("isActive                     Boolean");
  });

  it("permanent draw deletion cascades only through owned history and participant relations", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain('privateDraw   PrivateDraw @relation(fields: [privateDrawId], references: [id], onDelete: Cascade)');
    expect(schema).toContain('playerDraw            PlayerDraw         @relation("PlayerDrawParticipants", fields: [playerDrawId], references: [id], onDelete: Cascade)');
    expect(schema).toContain("playerDraw          PlayerDraw         @relation(fields: [playerDrawId], references: [id], onDelete: Cascade)");
    expect(schema).toContain("participant         PlayerParticipant? @relation(fields: [participantId], references: [id], onDelete: SetNull)");
  });

  it("keeps additive audit log fields for production security review", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("model AuditLog");
    expect(schema).toContain("success      Boolean    @default(true)");
    expect(schema).toContain("clientIpHash String?");
    expect(schema).toContain("@@index([action])");
  });

  it("keeps additive admin TOTP fields and challenge table", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("totpEnabled              Boolean                   @default(false)");
    expect(schema).toContain("totpSecretEncrypted      String?");
    expect(schema).toContain("totpSetupSecretEncrypted String?");
    expect(schema).toContain("totpLastUsedStep         Int?");
    expect(schema).toContain("model AdminTwoFactorChallenge");
    expect(schema).toContain("tokenHash   String    @unique");
  });
});
