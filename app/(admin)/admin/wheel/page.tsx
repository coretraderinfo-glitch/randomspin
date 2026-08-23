import { AdminShell } from "@/components/admin/AdminShell";
import { NumberEligibilityGrid } from "@/components/admin/NumberEligibilityGrid";
import { requireAdminPage } from "@/lib/admin-page";
import { getActiveWheelConfiguration } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function AdminWheelPage() {
  await requireAdminPage();
  const config = await getActiveWheelConfiguration();

  return (
    <AdminShell title="Legacy Wheel Config">
      <div className="danger-banner mb-5 rounded-lg px-4 py-3 text-sm font-semibold">
        This legacy configuration is kept for historical public spin records. Public Number Draw uses the visitor&apos;s selected range. Private Draws use their own draw settings.
      </div>
      <NumberEligibilityGrid
        config={{
          minNumber: config.minNumber,
          maxNumber: config.maxNumber,
          excludedNumbers: config.excludedNumbers
        }}
      />
    </AdminShell>
  );
}
