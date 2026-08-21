import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { getAdminDashboardSummary } from "@/lib/admin/reports";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const summary = await getAdminDashboardSummary();

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard label="Spins Today" value={summary.today.toLocaleString()} />
        <DashboardCard label="Total Spins" value={summary.total.toLocaleString()} />
        <DashboardCard label="Active Range" value={summary.activeRange} />
        <DashboardCard label="Eligible Numbers" value={summary.eligible.toLocaleString()} />
        <DashboardCard label="Excluded Numbers" value={summary.excludedInRange.toLocaleString()} />
        <DashboardCard
          label="Most Selected Result"
          value={summary.mostSelected?.number ?? "None"}
          detail={summary.mostSelected ? `${summary.mostSelected.count} wins` : "No spins yet."}
        />
      </div>
    </AdminShell>
  );
}
