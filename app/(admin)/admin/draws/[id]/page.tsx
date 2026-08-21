import { notFound } from "next/navigation";
import { DrawControlForm } from "@/components/admin/DrawControlForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin-page";
import { getPrivateDrawForAdmin } from "@/lib/private-draws";

export const dynamic = "force-dynamic";

export default async function AdminPrivateDrawPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const draw = await getPrivateDrawForAdmin(id);

  if (!draw) {
    notFound();
  }

  return (
    <AdminShell title="Private Draw Control">
      <div className="grid gap-5">
        <DrawControlForm
          draw={{
            id: draw.id,
            name: draw.name,
            publicCode: draw.publicCode,
            minNumber: draw.minNumber,
            maxNumber: draw.maxNumber,
            excludedNumbers: draw.excludedNumbers,
            mode: draw.mode,
            displayStyle: draw.displayStyle,
            pendingOperatorWinner: draw.pendingOperatorWinner,
            isActive: draw.isActive
          }}
        />

        <section className="glass rounded-xl p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Private History</p>
          <div className="mt-4 grid gap-2 text-sm">
            {draw.spinResults.length === 0 ? (
              <p className="text-[#aeb7ca]">No private draw results yet.</p>
            ) : (
              draw.spinResults.map((spin) => (
                <div key={spin.id} className="grid gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto]">
                  <p className="font-bold text-white">
                    Winner: {spin.winningNumber} · Mode: {spin.mode === "OPERATOR" ? "Operator" : "Random"}
                  </p>
                  <p className="text-[#aeb7ca]">{spin.createdAt.toISOString()}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
