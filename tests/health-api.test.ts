import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  redisState: "configured" as "configured" | "degraded" | "unavailable"
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw
  }
}));

vi.mock("@/lib/rate-limit", () => ({
  getRedisRateLimitHealthState: () => mocks.redisState
}));

describe("health API", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mocks.redisState = "configured";
    vi.restoreAllMocks();
  });

  it("reports database readiness without making Redis a liveness dependency", async () => {
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "lucky-spin",
      database: "ok",
      redisRateLimit: "configured"
    });
  });

  it("returns unavailable when the database cannot be queried and reports Redis configuration degradation", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("database unavailable"));
    mocks.redisState = "degraded";
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      service: "lucky-spin",
      database: "unavailable",
      redisRateLimit: "degraded"
    });
    expect(error).toHaveBeenCalledWith("Health check database query failed.");
  });

  it("reports a recent Redis infrastructure failure as unavailable without failing database health", async () => {
    mocks.redisState = "unavailable";
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "lucky-spin",
      database: "ok",
      redisRateLimit: "unavailable"
    });
  });
});
