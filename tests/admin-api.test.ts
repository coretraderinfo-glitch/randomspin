import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminFromRequest: vi.fn(),
  wheelFindFirst: vi.fn(),
  wheelUpsert: vi.fn(),
  settingsUpsert: vi.fn(),
  settingsUpdate: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/db", () => ({
  prisma: {
    wheelConfiguration: { findFirst: mocks.wheelFindFirst, upsert: mocks.wheelUpsert },
    siteSettings: { upsert: mocks.settingsUpsert, update: mocks.settingsUpdate },
    auditLog: { create: mocks.auditCreate }
  }
}));

describe("admin APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAdminFromRequest.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });
    mocks.wheelFindFirst.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: []
    });
    mocks.wheelUpsert.mockResolvedValue({ id: "wheel-1", minNumber: 1, maxNumber: 30, excludedNumbers: [7] });
    const settings = {
      id: "default",
      siteName: "RandomSpin",
      headline: "RandomSpin",
      subtitle: "Free random draws for names, numbers, and more.",
      announcement: null,
      soundEnabled: true,
      confettiEnabled: true,
      maintenanceMode: false,
      recentResultCount: 10,
      defaultFrom: 1,
      defaultTo: 30,
      maximumAllowedRange: 1000,
      publicDisclosureMessage: "Ready for the next draw.",
      timezone: "Asia/Kuala_Lumpur",
      contactEmail: null
    };
    mocks.settingsUpsert.mockResolvedValue(settings);
    mocks.settingsUpdate.mockResolvedValue(settings);
    mocks.auditCreate.mockResolvedValue({});
  });

  function adminRequest(url: string, body: unknown, origin = "http://localhost:3000") {
    return new NextRequest(url, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin }
    });
  }

  it("rejects unauthenticated wheel update", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/wheel/route");
    const response = await PUT(adminRequest("http://localhost:3000/api/admin/wheel", { minNumber: 1, maxNumber: 30 }));
    expect(response.status).toBe(401);
  });

  it("updates wheel settings for authenticated admin", async () => {
    const { PUT } = await import("@/app/api/admin/wheel/route");
    const response = await PUT(
      adminRequest("http://localhost:3000/api/admin/wheel", { minNumber: 1, maxNumber: 30, excludedNumbers: [7] })
    );
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("rejects invalid excluded numbers from manual text", async () => {
    const { PUT } = await import("@/app/api/admin/wheel/route");
    const response = await PUT(
      adminRequest("http://localhost:3000/api/admin/wheel", { minNumber: 1, maxNumber: 30, excludedText: "7,31" })
    );
    expect(response.status).toBe(400);
  });

  it("rejects invalid excluded numbers from array input", async () => {
    const { PUT } = await import("@/app/api/admin/wheel/route");
    const response = await PUT(
      adminRequest("http://localhost:3000/api/admin/wheel", { minNumber: 1, maxNumber: 30, excludedNumbers: [7, 31] })
    );
    expect(response.status).toBe(400);
  });

  it("rejects foreign origin and missing origin for state changes", async () => {
    const { PUT } = await import("@/app/api/admin/wheel/route");
    expect(
      (
        await PUT(adminRequest("http://localhost:3000/api/admin/wheel", { minNumber: 1, maxNumber: 30 }, "https://evil.example"))
      ).status
    ).toBe(403);
    expect(
      (
        await PUT(
          new NextRequest("http://localhost:3000/api/admin/wheel", {
            method: "PUT",
            body: JSON.stringify({ minNumber: 1, maxNumber: 30 }),
            headers: { "content-type": "application/json" }
          })
        )
      ).status
    ).toBe(403);
  });

  it("updates website settings for authenticated admin", async () => {
    const { PUT } = await import("@/app/api/admin/settings/route");
    const response = await PUT(
      adminRequest("http://localhost:3000/api/admin/settings", {
        siteName: "RandomSpin",
        headline: "RandomSpin",
        subtitle: "Free random draws for names, numbers, and more.",
        announcement: null,
        soundEnabled: true,
        confettiEnabled: true,
        maintenanceMode: false,
        recentResultCount: 10,
        defaultFrom: 1,
        defaultTo: 30,
        maximumAllowedRange: 1000,
        publicDisclosureMessage: "Ready for the next draw.",
        timezone: "Asia/Kuala_Lumpur",
        contactEmail: null
      })
    );
    expect(response.status).toBe(200);
  });
});
