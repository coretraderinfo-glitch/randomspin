import { AnalyticsChart } from "@/components/admin/AnalyticsChart";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { getAdminAnalyticsSummary } from "@/lib/admin/reports";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdminPage();
  const analytics = await getAdminAnalyticsSummary();

  return (
    <AdminShell title="Analytics">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Spins Today" value={analytics.cards.todayCount.toLocaleString()} />
        <DashboardCard label="This Week" value={analytics.cards.weekCount.toLocaleString()} />
        <DashboardCard label="This Month" value={analytics.cards.monthCount.toLocaleString()} />
        <DashboardCard label="Total Spins" value={analytics.cards.total.toLocaleString()} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsChart title="Most Selected Numbers" items={analytics.winners} />
        <AnalyticsChart title="Popular Ranges" items={analytics.ranges} />
        <div className="xl:col-span-2">
          <AnalyticsChart title="Hourly Activity" items={analytics.hourly} />
        </div>
      </div>
    </AdminShell>
  );
}
