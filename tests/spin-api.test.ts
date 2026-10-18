import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DRAW_NUMBER_ERROR, RANGE_ORDER_ERROR } from "@/lib/draw-range";
import { SpinValidationError } from "@/lib/spin";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  getActiveWheelConfiguration: vi.fn(),
  getSiteSettings: vi.fn(),
  spinCreate: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  selectSecureWinner: vi.fn()
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/public-data", () => ({
  getActiveWheelConfiguration: mocks.getActiveWheelConfiguration,
  getSiteSettings: mocks.getSiteSettings
}));
vi.mock("@/lib/db", () => ({ prisma: { spinResult: { create: mocks.spinCreate } } }));
vi.mock("@/lib/spin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/spin")>("@/lib/spin");
  return {
    ...actual,
    selectSecureWinner: mocks.selectSecureWinner
  };
});
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
    mocks.selectSecureWinner.mockImplementation(
      (from: number, to: number, rules: { maximumAllowedRange?: number }) => {
        const maximumAllowedRange = rules.maximumAllowedRange ?? 1000;
        if (from >= to) {
          throw new SpinValidationError(RANGE_ORDER_ERROR);
        }

        if (to > maximumAllowedRange) {
          throw new SpinValidationError(MAX_DRAW_NUMBER_ERROR);
        }

        return {
          winner: from,
          eligiblePool: Array.from({ length: to - from + 1 }, (_, index) => from + index),
          requestedMin: from,
          requestedMax: to
        };
      }
    );
    mocks.spinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number } }) => ({
      id: "spin-1",
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-19T00:00:00.000Z")
    }));
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
    expect(body).toEqual({
      spinId: "spin-1",
      winner: 1,
      from: 1,
      to: 30,
      timestamp: "2026-08-19T00:00:00.000Z",
      serverTime: "2026-08-19T00:00:00.000Z"
    });
    expect(JSON.stringify(body)).not.toContain("excludedNumbers");
    expect(JSON.stringify(body)).not.toContain("eligibleNumbers");
    expect(JSON.stringify(body)).not.toContain("admin");
    expect(mocks.rateLimit).toHaveBeenCalledWith("spin:local-development", expect.any(Number), 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "public spin"
    });
  });

  it("does not let Admin Wheel Control clamp the public visitor range", async () => {
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 5,
      excludedNumbers: Array.from({ length: 29 }, (_, index) => index + 2)
    });
    mocks.selectSecureWinner.mockImplementation((from: number, to: number, rules: Record<string, unknown>) => {
      expect(from).toBe(1);
      expect(to).toBe(30);
      expect(rules).toEqual({
        configMin: 1,
        configMax: 30,
        excludedNumbers: [],
        maximumAllowedRange: 1000
      });
      return {
        winner: 24,
        eligiblePool: Array.from({ length: 30 }, (_, index) => index + 1),
        requestedMin: 1,
        requestedMax: 30
      };
    });

    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      spinId: "spin-1",
      winner: 24,
      from: 1,
      to: 30,
      timestamp: "2026-08-19T00:00:00.000Z",
      serverTime: "2026-08-19T00:00:00.000Z"
    });
    expect(mocks.spinCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        wheelConfigurationId: "wheel-1",
        requestedMin: 1,
        requestedMax: 30,
        winningNumber: 24,
        eligibleCount: 30
      })
    });
  });

  it("keeps the public homepage spin server-random and ignores forced winner input", async () => {
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 30, winner: 18, mode: "OPERATOR" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.winner).not.toBe(18);
  });

  it.each([
    { from: 1, to: 5, winner: 5 },
    { from: 1, to: 30, winner: 24 },
    { from: 1, to: 101, winner: 101 },
    { from: 1, to: 500, winner: 500 },
    { from: 1, to: 1000, winner: 1000 },
    { from: 10, to: 50, winner: 24 }
  ])("selects from the public submitted range $from-$to", async ({ from, to, winner }) => {
    mocks.selectSecureWinner.mockReturnValue({
      winner,
      eligiblePool: Array.from({ length: to - from + 1 }, (_, index) => from + index),
      requestedMin: from,
      requestedMax: to
    });

    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from, to }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ winner, from, to }));
    expect(mocks.spinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedMin: from,
          requestedMax: to,
          winningNumber: winner,
          eligibleCount: to - from + 1
        })
      })
    );
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

  it("rejects public 1-1001 clearly without silently clamping", async () => {
    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 1001 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(MAX_DRAW_NUMBER_ERROR);
    expect(mocks.selectSecureWinner).toHaveBeenCalledWith(
      1,
      1001,
      expect.objectContaining({
        configMin: 1,
        configMax: 1001,
        maximumAllowedRange: 1000
      })
    );
    expect(mocks.selectSecureWinner).not.toHaveBeenCalledWith(1, 1000, expect.anything());
    expect(mocks.spinCreate).not.toHaveBeenCalled();
  });

  it("ignores stale global public exclusions instead of secretly shrinking the public pool", async () => {
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      id: "wheel-1",
      minNumber: 1,
      maxNumber: 3,
      excludedNumbers: [1, 2, 3]
    });
    mocks.selectSecureWinner.mockReturnValue({
      winner: 2,
      eligiblePool: [1, 2, 3],
      requestedMin: 1,
      requestedMax: 3
    });

    const { POST } = await import("@/app/api/spin/route");
    const response = await POST(request({ from: 1, to: 3 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ winner: 2, from: 1, to: 3 }));
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

  it("persists a spin after the draw rate-limit availability fallback", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: true, usedAvailabilityFallback: true });
    const { POST } = await import("@/app/api/spin/route");

    const response = await POST(request({ from: 1, to: 30 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(mocks.selectSecureWinner).toHaveBeenCalledWith(1, 30, expect.any(Object));
    expect(mocks.spinCreate).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith("spin:local-development", expect.any(Number), 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "public spin"
    });
  });
});
