import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  verifyAdminCredentials: vi.fn(),
  createAdminSession: vi.fn(),
  createAdminTwoFactorChallenge: vi.fn(),
  getAdminFromRequest: vi.fn(),
  revokeCurrentSession: vi.fn(),
  revokeAllAdminSessions: vi.fn(),
  logAdminAudit: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/admin-audit", () => ({ logAdminAudit: mocks.logAdminAudit }));
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAdminCredentials: mocks.verifyAdminCredentials,
    createAdminSession: mocks.createAdminSession,
    createAdminTwoFactorChallenge: mocks.createAdminTwoFactorChallenge,
    getAdminFromRequest: mocks.getAdminFromRequest,
    revokeCurrentSession: mocks.revokeCurrentSession,
    revokeAllAdminSessions: mocks.revokeAllAdminSessions
  };
});

describe("admin authentication API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.verifyAdminCredentials.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });
    mocks.getAdminFromRequest.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });
    mocks.createAdminSession.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-08-26T00:00:00.000Z")
    });
    mocks.createAdminTwoFactorChallenge.mockResolvedValue({ token: "two-factor-challenge", expiresAt: new Date("2026-08-23T00:05:00.000Z") });
    mocks.revokeAllAdminSessions.mockResolvedValue({ count: 3 });
  });

  function loginRequest(body: unknown, origin = "http://localhost:3000") {
    return new NextRequest("http://localhost:3000/api/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin }
    });
  }

  it("creates a secure session cookie on successful login", async () => {
    const { POST } = await import("@/app/api/admin/login/route");
    const response = await POST(loginRequest({ email: "owner@example.com", password: "correct-password" }));
    const cookie = response.cookies.get("lucky_admin_session");

    expect(response.status).toBe(200);
    expect(cookie?.value).toBe("session-token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_LOGIN_SUCCEEDED", adminUserId: "admin-1" }));
  });

  it("rejects failed login", async () => {
    mocks.verifyAdminCredentials.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/login/route");
    const response = await POST(loginRequest({ email: "owner@example.com", password: "wrong-password" }));
    expect(response.status).toBe(401);
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_LOGIN_FAILED", success: false }));
  });

  it("does not fail open admin login when rate-limit infrastructure fails", async () => {
    mocks.rateLimit.mockRejectedValue(new TypeError("fetch failed"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/admin/login/route");

    const response = await POST(loginRequest({ email: "owner@example.com", password: "correct-password" }));

    expect(response.status).toBe(500);
    expect(mocks.verifyAdminCredentials).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("password-only login does not create a full session for 2FA-enabled admin", async () => {
    mocks.verifyAdminCredentials.mockResolvedValue({ id: "admin-1", email: "owner@example.com", totpEnabled: true });
    const { POST } = await import("@/app/api/admin/login/route");

    const response = await POST(loginRequest({ email: "owner@example.com", password: "correct-password" }));
    const body = await response.json();
    const cookie = response.cookies.get("lucky_admin_session");

    expect(response.status).toBe(200);
    expect(body).toEqual({ requiresTwoFactor: true, challengeToken: "two-factor-challenge" });
    expect(cookie).toBeUndefined();
    expect(mocks.createAdminSession).not.toHaveBeenCalled();
    expect(mocks.createAdminTwoFactorChallenge).toHaveBeenCalledWith("admin-1");
  });

  it("does not let spoofed X-Forwarded-For rotate the Railway login rate-limit key", async () => {
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = "staging";
    const { POST } = await import("@/app/api/admin/login/route");

    await POST(
      new NextRequest("https://randomspin-staging.up.railway.app/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com", password: "correct-password" }),
        headers: {
          "content-type": "application/json",
          origin: "https://randomspin-staging.up.railway.app",
          host: "randomspin-staging.up.railway.app",
          "x-real-ip": "203.0.113.24",
          "x-forwarded-for": "198.51.100.1"
        }
      })
    );
    await POST(
      new NextRequest("https://randomspin-staging.up.railway.app/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com", password: "correct-password" }),
        headers: {
          "content-type": "application/json",
          origin: "https://randomspin-staging.up.railway.app",
          host: "randomspin-staging.up.railway.app",
          "x-real-ip": "203.0.113.24",
          "x-forwarded-for": "198.51.100.2"
        }
      })
    );

    expect(mocks.rateLimit).toHaveBeenNthCalledWith(1, "admin-login:203.0.113.24", expect.any(Number), 60_000);
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(2, "admin-login:203.0.113.24", expect.any(Number), 60_000);

    if (previousRailway === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT;
    } else {
      process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }
  });

  it("rejects login without valid origin", async () => {
    const { POST } = await import("@/app/api/admin/login/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com", password: "correct-password" }),
        headers: { "content-type": "application/json" }
      })
    );
    expect(response.status).toBe(403);
  });

  it("logs out by revoking the current session and clearing cookie", async () => {
    const { POST } = await import("@/app/api/admin/logout/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/logout", {
        method: "POST",
        headers: { origin: "http://localhost:3000", cookie: "lucky_admin_session=session-token" }
      })
    );
    const cookie = response.cookies.get("lucky_admin_session");

    expect(response.status).toBe(200);
    expect(mocks.revokeCurrentSession).toHaveBeenCalled();
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_LOGOUT", adminUserId: "admin-1" }));
    expect(cookie?.value).toBe("");
  });

  it("logs out all sessions for the current admin", async () => {
    const { POST } = await import("@/app/api/admin/sessions/revoke-all/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/sessions/revoke-all", {
        method: "POST",
        headers: { origin: "http://localhost:3000", cookie: "lucky_admin_session=session-token" }
      })
    );
    const body = await response.json();
    const cookie = response.cookies.get("lucky_admin_session");

    expect(response.status).toBe(200);
    expect(body.revokedCount).toBe(3);
    expect(mocks.revokeAllAdminSessions).toHaveBeenCalledWith("admin-1");
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_SESSIONS_REVOKED", adminUserId: "admin-1" }));
    expect(cookie?.value).toBe("");
  });
});
