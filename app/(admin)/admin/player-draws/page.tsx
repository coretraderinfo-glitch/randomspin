import { AdminShell } from "@/components/admin/AdminShell";
import { PlayerDrawManager } from "@/components/admin/PlayerDrawManager";
import { requireAdminPage } from "@/lib/admin-page";
import { listPlayerDraws } from "@/lib/player-draws";

export const dynamic = "force-dynamic";

export default async function AdminPlayerDrawsPage() {
  await requireAdminPage();
  const draws = await listPlayerDraws();

  return (
    <AdminShell title="Player Draws">
      <PlayerDrawManager
        initialDraws={draws.map((draw) => ({
          ...draw,
          createdAt: draw.createdAt.toISOString(),
          updatedAt: draw.updatedAt.toISOString()
        }))}
      />
    </AdminShell>
  );
}
