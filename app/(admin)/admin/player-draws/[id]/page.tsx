import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlayerDrawControlForm } from "@/components/admin/PlayerDrawControlForm";
import { requireAdminPage } from "@/lib/admin-page";
import { getPlayerDrawForAdmin } from "@/lib/player-draws";

export const dynamic = "force-dynamic";

export default async function AdminPlayerDrawPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const draw = await getPlayerDrawForAdmin(id);

  if (!draw) {
    notFound();
  }

  return (
    <AdminShell title="Player Draw Control">
      <div className="grid gap-5">
        <PlayerDrawControlForm
          draw={{
            id: draw.id,
            publicCode: draw.publicCode,
            name: draw.name,
            mode: draw.mode,
            pendingOperatorParticipantId: draw.pendingOperatorParticipantId,
            isActive: draw.isActive,
            removeWinnerAfterWin: draw.removeWinnerAfterWin,
            showParticipantList: draw.showParticipantList,
            showReferencesPublicly: draw.showReferencesPublicly,
            revision: draw.updatedAt.toISOString(),
            participants: draw.participants.map((participant) => ({
              id: participant.id,
              displayName: participant.displayName,
              reference: participant.reference,
              isEligible: participant.isEligible
            }))
          }}
        />

        <section className="glass rounded-xl p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Player History</p>
          <div className="mt-4 grid gap-2 text-sm">
            {draw.results.length === 0 ? (
              <p className="text-[#aeb7ca]">No player draw results yet.</p>
            ) : (
              draw.results.map((result, index) => (
                <div key={result.id} className="grid gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto]">
                  <p className="font-bold text-white">
                    #{draw.results.length - index} {result.displayNameSnapshot}
                    {result.referenceSnapshot ? ` · Reference: ${result.referenceSnapshot}` : ""} · Mode:{" "}
                    {result.mode === "OPERATOR" ? "Operator" : "Random"}
                  </p>
                  <p className="text-[#aeb7ca]">{result.createdAt.toISOString()}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
