import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveWheelConfiguration: vi.fn(),
  getSiteSettings: vi.fn(),
  spinCount: vi.fn(),
  spinGroupBy: vi.fn(),
  spinFindMany: vi.fn()
}));

vi.mock("@/lib/public-data", () => ({
  getActiveWheelConfiguration: mocks.getActiveWheelConfiguration,
  getSiteSettings: mocks.getSiteSettings
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    spinResult: {
      count: mocks.spinCount,
      groupBy: mocks.spinGroupBy,
      findMany: mocks.spinFindMany
    }
  }
}));

describe("admin reporting helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSiteSettings.mockResolvedValue({ timezone: "Asia/Kuala_Lumpur" });
  });

  it("uses the configured timezone for analytics boundaries and hourly buckets", async () => {
    mocks.spinCount.mockResolvedValueOnce(2).mockResolvedValueOnce(4).mockResolvedValueOnce(6).mockResolvedValueOnce(8);
    mocks.spinGroupBy
      .mockResolvedValueOnce([{ winningNumber: 7, _count: { winningNumber: 3 } }])
      .mockResolvedValueOnce([{ requestedMin: 1, requestedMax: 30, _count: { requestedMin: 5 } }]);
    mocks.spinFindMany.mockResolvedValue([
      { createdAt: new Date("2026-08-18T16:30:00.000Z") },
      { createdAt: new Date("2026-08-18T23:30:00.000Z") }
    ]);

    const { getAdminAnalyticsSummary } = await import("@/lib/admin/reports");
    const summary = await getAdminAnalyticsSummary(new Date("2026-08-19T01:00:00.000Z"));

    expect(mocks.spinCount).toHaveBeenNthCalledWith(1, {
      where: { createdAt: { gte: new Date("2026-08-18T16:00:00.000Z") } }
    });
    expect(summary.cards).toEqual({ todayCount: 2, weekCount: 4, monthCount: 6, total: 8 });
    expect(summary.winners).toEqual([{ label: "7", value: 3 }]);
    expect(summary.ranges).toEqual([{ label: "1-30", value: 5 }]);
    expect(summary.hourly[0]).toEqual({ label: "0:00", value: 1 });
    expect(summary.hourly[7]).toEqual({ label: "7:00", value: 1 });
  });

  it("derives dashboard eligibility from the active wheel without exposing excluded values", async () => {
    mocks.getActiveWheelConfiguration.mockResolvedValue({
      minNumber: 1,
      maxNumber: 10,
      excludedNumbers: [2, 4, 99]
    });
    mocks.spinCount.mockResolvedValueOnce(3).mockResolvedValueOnce(20);
    mocks.spinGroupBy.mockResolvedValueOnce([{ winningNumber: 8, _count: { winningNumber: 4 } }]);

    const { getAdminDashboardSummary } = await import("@/lib/admin/reports");
    const summary = await getAdminDashboardSummary(new Date("2026-08-19T01:00:00.000Z"));

    expect(summary).toMatchObject({
      today: 3,
      total: 20,
      activeRange: "1-10",
      eligible: 8,
      excludedInRange: 2,
      mostSelected: { number: 8, count: 4 }
    });
  });
});
