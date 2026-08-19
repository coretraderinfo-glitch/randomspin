import { AnalyticsChart } from "@/components/admin/AnalyticsChart";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/public-data";
import { startOfZonedDay, startOfZonedMonth, startOfZonedWeek } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdminPage();
  const settings = await getSiteSettings();
  const now = new Date();
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
    value: latest.filter((spin) => spin.createdAt.getHours() === hour).length
  }));

  return (
    <AdminShell title="Analytics">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Spins Today" value={todayCount.toLocaleString()} />
        <DashboardCard label="This Week" value={weekCount.toLocaleString()} />
        <DashboardCard label="This Month" value={monthCount.toLocaleString()} />
        <DashboardCard label="Total Spins" value={total.toLocaleString()} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsChart
          title="Most Selected Numbers"
          items={winners.map((item) => ({ label: String(item.winningNumber), value: item._count.winningNumber }))}
        />
        <AnalyticsChart
          title="Popular Ranges"
          items={ranges.map((item) => ({ label: `${item.requestedMin}-${item.requestedMax}`, value: item._count.requestedMin }))}
        />
        <div className="xl:col-span-2">
          <AnalyticsChart title="Hourly Activity" items={hourly} />
        </div>
      </div>
    </AdminShell>
  );
}
