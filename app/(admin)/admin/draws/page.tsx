import { PrivateDrawManager } from "@/components/admin/PrivateDrawManager";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin-page";
import { listPrivateDraws } from "@/lib/private-draws";

export const dynamic = "force-dynamic";

export default async function AdminPrivateDrawsPage() {
  await requireAdminPage();
  const draws = await listPrivateDraws();

  return (
    <AdminShell title="Private Draws">
      <PrivateDrawManager
        initialDraws={draws.map((draw) => ({
          ...draw,
          archivedAt: draw.archivedAt?.toISOString() ?? null,
          createdAt: draw.createdAt.toISOString(),
          updatedAt: draw.updatedAt.toISOString()
        }))}
      />
    </AdminShell>
  );
}
