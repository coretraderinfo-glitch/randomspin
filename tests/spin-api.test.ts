import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  getActiveWheelConfiguration: vi.fn(),
  getSiteSettings: vi.fn(),
  spinCreate: vi.fn(),
  isDatabaseConfigured: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/public-data", () => ({
  getActiveWheelConfiguration: mocks.getActiveWheelConfiguration,
  getSiteSettings: mocks.getSiteSettings
}));
vi.mock("@/lib/db", () => ({ prisma: { spinResult: { create: mocks.spinCreate } } }));
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return { ...actual, isDatabaseConfigured: mocks.isDatabaseConfigured };
});

describe("spin API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: [7, 18, 25]
    });
    mocks.getSiteSettings.mockResolvedValue({
      maintenanceMode: false,
      maximumAllowedRange: 1000
    });
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.spinCreate.mockResolvedValue({
      id: "spin-1",
      winningNumber: 1,
      createdAt: new Date("2026-08-19T00:00:00.000Z")
    });
  });

  function request(body: unknown) {
    return new NextRequest("http://localhost:3000/api/spin", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" }
    });
  }

  it("returns a valid persisted spin without private fields", async () => {
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ spinId: "spin-1", winner: 1, timestamp: "2026-08-19T00:00:00.000Z" });
    expect(JSON.stringify(body)).not.toContain("excludedNumbers");
    expect(JSON.stringify(body)).not.toContain("eligibleNumbers");
    expect(JSON.stringify(body)).not.toContain("admin");
  });

  it("keeps the public homepage spin server-random and ignores forced winner input", async () => {
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: Array.from({ length: 29 }, (_, index) => index + 2)
    });
    mocks.spinCreate.mockResolvedValue({
      id: "spin-1",
      winningNumber: 1,
      createdAt: new Date("2026-08-19T00:00:00.000Z")
    });

    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30, winner: 18, mode: "OPERATOR" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.winner).not.toBe(18);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
  });

  it.each([
    [{ from: 30, to: 1 }, "FROM > TO"],
    [{ from: 1, to: 1 }, "FROM = TO"],
    [{ from: 1, to: 1001 }, "too large range"]
  ])("rejects invalid range: %s", async (body) => {
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request(body));
    expect(response.status).toBe(400);
  });

  it("rejects all numbers unavailable without exposing why", async () => {
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 3,
      excludedNumbers: [1, 2, 3]
    });
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 3 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No eligible results are currently available for this range.");
    expect(JSON.stringify(body)).not.toContain("1,2,3");
  });

  it("rejects maintenance mode", async () => {
    mocks.getSiteSettings.mockResolvedValue({ maintenanceMode: true, maximumAllowedRange: 1000 });
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30 }));
    expect(response.status).toBe(503);
  });

  it("rate limits with HTTP 429", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30 }));
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many requests. Please try again shortly.");
  });
});
