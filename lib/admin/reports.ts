import "server-only";
import { prisma } from "@/lib/db";
import { getActiveWheelConfiguration, getSiteSettings } from "@/lib/public-data";
import { getZonedParts, startOfZonedDay, startOfZonedMonth, startOfZonedWeek } from "@/lib/timezone";

export type AdminHistoryParams = {
  page?: number;
  winner?: number;
  take?: number;
};

export async function getAdminDashboardSummary(now = new Date()) {
  const [config, settings] = await Promise.all([getActiveWheelConfiguration(), getSiteSettings()]);
  const todayStart = startOfZonedDay(now, settings.timezone);

  const [today, total, mostSelected] = await Promise.all([
    prisma.spinResult.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.spinResult.count(),
    prisma.spinResult.groupBy({
      by: ["winningNumber"],
      _count: { winningNumber: true },
      orderBy: { _count: { winningNumber: "desc" } },
      take: 1
    })
  ]);

  const activeRangeCount = config.maxNumber - config.minNumber + 1;
  const excludedInRange = config.excludedNumbers.filter((number) => number >= config.minNumber && number <= config.maxNumber).length;

  return {
    today,
    total,
    activeRange: `${config.minNumber}-${config.maxNumber}`,
    eligible: activeRangeCount - excludedInRange,
    excludedInRange,
    mostSelected: mostSelected[0]
      ? {
          number: mostSelected[0].winningNumber,
          count: mostSelected[0]._count.winningNumber
        }
      : null
  };
}

export async function getAdminAnalyticsSummary(now = new Date()) {
  const settings = await getSiteSettings();
  const today = startOfZonedDay(now, settings.timezone);
  const week = startOfZonedWeek(now, settings.timezone);
  const month = startOfZonedMonth(now, settings.timezone);

  const [todayCount, weekCount, monthCount, total, winners, ranges, latest] = await Promise.all([
    prisma.spinResult.count({ where: { createdAt: { gte: today } } }),
    prisma.spinResult.count({ where: { createdAt: { gte: week } } }),
    prisma.spinResult.count({ where: { createdAt: { gte: month } } }),
    prisma.spinResult.count(),
    prisma.spinResult.groupBy({
      by: ["winningNumber"],
      _count: { winningNumber: true },
      orderBy: { _count: { winningNumber: "desc" } },
      take: 8
    }),
    prisma.spinResult.groupBy({
      by: ["requestedMin", "requestedMax"],
      _count: { requestedMin: true },
      orderBy: { _count: { requestedMin: "desc" } },
      take: 8
    }),
    prisma.spinResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { createdAt: true }
    })
  ]);

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    label: `${hour}:00`,
    value: latest.filter((spin) => getZonedParts(spin.createdAt, settings.timezone).hour === hour).length
  }));

  return {
    cards: { todayCount, weekCount, monthCount, total },
    winners: winners.map((item) => ({ label: String(item.winningNumber), value: item._count.winningNumber })),
    ranges: ranges.map((item) => ({ label: `${item.requestedMin}-${item.requestedMax}`, value: item._count.requestedMin })),
    hourly
  };
}

export async function getAdminHistoryPage({ page = 1, winner, take = 25 }: AdminHistoryParams) {
  const safePage = Math.max(page, 1);
  const settings = await getSiteSettings();
  const where = winner === undefined ? {} : { winningNumber: winner };

  const [items, total] = await Promise.all([
    prisma.spinResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * take,
      take
    }),
    prisma.spinResult.count({ where })
  ]);

  return {
    items,
    total,
    page: safePage,
    pageCount: Math.max(Math.ceil(total / take), 1),
    timezone: settings.timezone
  };
}
