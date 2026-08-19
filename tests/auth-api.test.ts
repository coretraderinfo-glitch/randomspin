import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  verifyAdminCredentials: vi.fn(),
  createAdminSession: vi.fn(),
  revokeCurrentSession: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAdminCredentials: mocks.verifyAdminCredentials,
    createAdminSession: mocks.createAdminSession,
    revokeCurrentSession: mocks.revokeCurrentSession
  };
});

describe("admin authentication API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.verifyAdminCredentials.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });
    mocks.createAdminSession.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-08-26T00:00:00.000Z")
    });
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
  });

  it("rejects failed login", async () => {
    mocks.verifyAdminCredentials.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/login/route");
    const response = await POST(loginRequest({ email: "owner@example.com", password: "wrong-password" }));
    expect(response.status).toBe(401);
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
    expect(cookie?.value).toBe("");
  });
});
