import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminSession: {
      findFirst: mocks.findFirst
    }
  }
}));

describe("admin session validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows an active session", async () => {
    mocks.findFirst.mockResolvedValue({ adminUser: { id: "admin-1", email: "owner@example.com" } });
    const { getAdminFromRequest } = await import("@/lib/auth");
    const admin = await getAdminFromRequest(
      new NextRequest("http://localhost:3000/api/admin/wheel", {
        headers: { cookie: "lucky_admin_session=active-token" }
      })
    );
    expect(admin?.id).toBe("admin-1");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) }
        })
      })
    );
  });

  it("denies revoked or expired sessions when the database returns no active match", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { getAdminFromRequest } = await import("@/lib/auth");
    const admin = await getAdminFromRequest(
      new NextRequest("http://localhost:3000/api/admin/wheel", {
        headers: { cookie: "lucky_admin_session=old-token" }
      })
    );
    expect(admin).toBeNull();
  });
});
