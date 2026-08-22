import { AdminShell } from "@/components/admin/AdminShell";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const admin = await requireAdminPage();

  return (
    <AdminShell title="Security">
      <TwoFactorSettings enabled={admin.totpEnabled} />
    </AdminShell>
  );
}
