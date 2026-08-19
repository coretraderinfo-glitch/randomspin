import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/db";
import { getActiveWheelConfiguration, getSiteSettings } from "@/lib/public-data";
import { startOfZonedDay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();

  const [config, settings] = await Promise.all([getActiveWheelConfiguration(), getSiteSettings()]);
  const [today, total, mostSelected] = await Promise.all([
    prisma.spinResult.count({ where: { createdAt: { gte: startOfZonedDay(new Date(), settings.timezone) } } }),
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
  const eligible = activeRangeCount - excludedInRange;

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard label="Spins Today" value={today.toLocaleString()} />
        <DashboardCard label="Total Spins" value={total.toLocaleString()} />
        <DashboardCard label="Active Range" value={`${config.minNumber}-${config.maxNumber}`} />
        <DashboardCard label="Eligible Numbers" value={eligible.toLocaleString()} />
        <DashboardCard label="Excluded Numbers" value={excludedInRange.toLocaleString()} />
        <DashboardCard
          label="Most Selected Result"
          value={mostSelected[0]?.winningNumber ?? "None"}
          detail={mostSelected[0] ? `${mostSelected[0]._count.winningNumber} wins` : "No spins yet."}
        />
      </div>
    </AdminShell>
  );
}
