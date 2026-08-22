import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminFromRequest: vi.fn(),
  getAdminTwoFactorChallenge: vi.fn(),
  markAdminTwoFactorChallengeUsed: vi.fn(),
  createAdminSession: vi.fn(),
  setAdminCookie: vi.fn(),
  rateLimit: vi.fn(),
  adminUserFindUnique: vi.fn(),
  adminUserUpdate: vi.fn(),
  adminUserUpdateMany: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getAdminFromRequest: mocks.getAdminFromRequest,
    getAdminTwoFactorChallenge: mocks.getAdminTwoFactorChallenge,
    markAdminTwoFactorChallengeUsed: mocks.markAdminTwoFactorChallengeUsed,
    createAdminSession: mocks.createAdminSession,
    setAdminCookie: mocks.setAdminCookie
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminUserFindUnique,
      update: mocks.adminUserUpdate,
      updateMany: mocks.adminUserUpdateMany
    },
    auditLog: { create: mocks.auditCreate }
  }
}));

function adminRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie: "lucky_admin_session=session-token" }
  });
}

describe("admin TOTP 2FA", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.ADMIN_TOTP_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
    mocks.getAdminFromRequest.mockResolvedValue({ id: "admin-1", email: "owner@example.com", totpEnabled: false });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.auditCreate.mockResolvedValue({});
    mocks.adminUserFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "owner@example.com",
      passwordHash: await bcrypt.hash("correct-password", 12),
      totpEnabled: false,
      totpSecretEncrypted: null,
      totpSetupSecretEncrypted: null,
      totpLastUsedStep: null
    });
    mocks.adminUserUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "admin-1",
      email: "owner@example.com",
      ...data
    }));
    mocks.createAdminSession.mockResolvedValue({ token: "full-session-token", expiresAt: new Date("2026-08-26T00:00:00.000Z") });
    mocks.markAdminTwoFactorChallengeUsed.mockResolvedValue({ count: 1 });
    mocks.adminUserUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("setup requires authenticated session", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/totp/setup/route");

    const response = await POST(adminRequest("http://localhost:3000/api/admin/totp/setup", { password: "correct-password" }));

    expect(response.status).toBe(401);
  });

  it("setup requires correct password", async () => {
    const { POST } = await import("@/app/api/admin/totp/setup/route");

    const response = await POST(adminRequest("http://localhost:3000/api/admin/totp/setup", { password: "wrong-password" }));

    expect(response.status).toBe(401);
    expect(mocks.adminUserUpdate).not.toHaveBeenCalled();
  });

  it("generates setup QR and manual key server-side without enabling 2FA", async () => {
    const { POST } = await import("@/app/api/admin/totp/setup/route");

    const response = await POST(adminRequest("http://localhost:3000/api/admin/totp/setup", { password: "correct-password" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manualKey).toMatch(/^[A-Z2-7]+$/);
    expect(body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mocks.adminUserUpdate).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: expect.objectContaining({
        totpSetupSecretEncrypted: expect.stringMatching(/^v1\./),
        totpSetupStartedAt: expect.any(Date)
      })
    });
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain(body.manualKey);
  });

  it("rejects invalid setup TOTP and enables valid setup TOTP", async () => {
    const { encryptTotpSecret, generateTotpCode } = await import("@/lib/admin-totp");
    const secret = "JBSWY3DPEHPK3PXP";
    mocks.adminUserFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "owner@example.com",
      passwordHash: await bcrypt.hash("correct-password", 12),
      totpSetupSecretEncrypted: encryptTotpSecret(secret)
    });
    const { POST } = await import("@/app/api/admin/totp/verify/route");

    const invalid = await POST(adminRequest("http://localhost:3000/api/admin/totp/verify", { code: "000000" }));
    const valid = await POST(adminRequest("http://localhost:3000/api/admin/totp/verify", { code: generateTotpCode(secret) }));

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
    expect(mocks.adminUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totpEnabled: true,
          totpSecretEncrypted: expect.stringMatching(/^v1\./),
          totpSetupSecretEncrypted: null,
          totpLastUsedStep: expect.any(Number)
        })
      })
    );
  });

  it("valid password plus valid TOTP creates a session and rejects replay", async () => {
    const { encryptTotpSecret, generateTotpCode, getTotpStep } = await import("@/lib/admin-totp");
    const secret = "JBSWY3DPEHPK3PXP";
    mocks.getAdminTwoFactorChallenge.mockResolvedValue({
      id: "challenge-1",
      adminUser: {
        id: "admin-1",
        totpEnabled: true,
        totpSecretEncrypted: encryptTotpSecret(secret),
        totpLastUsedStep: null
      }
    });
    const { POST } = await import("@/app/api/admin/login/totp/route");
    const validCode = generateTotpCode(secret);

    const response = await POST(adminRequest("http://localhost:3000/api/admin/login/totp", { challengeToken: "challenge-token-value", code: validCode }));
    expect(response.status).toBe(200);
    expect(mocks.createAdminSession).toHaveBeenCalledWith("admin-1");

    mocks.getAdminTwoFactorChallenge.mockResolvedValue({
      id: "challenge-2",
      adminUser: {
        id: "admin-1",
        totpEnabled: true,
        totpSecretEncrypted: encryptTotpSecret(secret),
        totpLastUsedStep: getTotpStep()
      }
    });
    const replay = await POST(adminRequest("http://localhost:3000/api/admin/login/totp", { challengeToken: "challenge-token-value-2", code: validCode }));
    expect(replay.status).toBe(401);
  });

  it("does not create a session when the current TOTP step was already consumed concurrently", async () => {
    const { encryptTotpSecret, generateTotpCode } = await import("@/lib/admin-totp");
    const secret = "JBSWY3DPEHPK3PXP";
    mocks.getAdminTwoFactorChallenge.mockResolvedValue({
      id: "challenge-1",
      adminUser: {
        id: "admin-1",
        totpEnabled: true,
        totpSecretEncrypted: encryptTotpSecret(secret),
        totpLastUsedStep: null
      }
    });
    mocks.adminUserUpdateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import("@/app/api/admin/login/totp/route");

    const response = await POST(adminRequest("http://localhost:3000/api/admin/login/totp", { challengeToken: "challenge-token-value", code: generateTotpCode(secret) }));

    expect(response.status).toBe(401);
    expect(mocks.createAdminSession).not.toHaveBeenCalled();
  });

  it("rejects out-of-window TOTP but allows small clock drift", async () => {
    const { generateTotpCode, getTotpStep, verifyTotpCode } = await import("@/lib/admin-totp");
    const secret = "JBSWY3DPEHPK3PXP";
    const now = Date.now();

    expect(verifyTotpCode(secret, generateTotpCode(secret, getTotpStep(now) - 1), { now })).not.toBeNull();
    expect(verifyTotpCode(secret, generateTotpCode(secret, getTotpStep(now) - 3), { now })).toBeNull();
  });

  it("rate limits TOTP verification attempts", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("@/app/api/admin/totp/verify/route");

    const response = await POST(adminRequest("http://localhost:3000/api/admin/totp/verify", { code: "123456" }));

    expect(response.status).toBe(429);
  });

  it("disable requires password and valid TOTP", async () => {
    const { encryptTotpSecret, generateTotpCode } = await import("@/lib/admin-totp");
    const secret = "JBSWY3DPEHPK3PXP";
    mocks.adminUserFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "owner@example.com",
      passwordHash: await bcrypt.hash("correct-password", 12),
      totpEnabled: true,
      totpSecretEncrypted: encryptTotpSecret(secret)
    });
    const { POST } = await import("@/app/api/admin/totp/disable/route");

    const invalid = await POST(adminRequest("http://localhost:3000/api/admin/totp/disable", { password: "wrong-password", code: generateTotpCode(secret) }));
    const valid = await POST(adminRequest("http://localhost:3000/api/admin/totp/disable", { password: "correct-password", code: generateTotpCode(secret) }));

    expect(invalid.status).toBe(401);
    expect(valid.status).toBe(200);
    expect(mocks.adminUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totpEnabled: false,
          totpSecretEncrypted: null,
          totpLastUsedStep: null
        })
      })
    );
  });
});
