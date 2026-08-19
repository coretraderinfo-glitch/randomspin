import { AdminShell } from "@/components/admin/AdminShell";
import { NumberEligibilityGrid } from "@/components/admin/NumberEligibilityGrid";
import { requireAdminPage } from "@/lib/admin-page";
import { getActiveWheelConfiguration } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function AdminWheelPage() {
  await requireAdminPage();
  const config = await getActiveWheelConfiguration();

  return (
    <AdminShell title="Wheel Control">
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
