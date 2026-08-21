import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminHistoryPage } from "@/lib/admin/reports";
import { requireAdminPage } from "@/lib/admin-page";
import { formatInTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminHistoryPage({ searchParams }: HistoryPageProps) {
  await requireAdminPage();
  const params = (await searchParams) ?? {};
  const page = Math.max(Number(params.page ?? "1"), 1);
  const winnerValue = Number(params.winner ?? "");
  const winner = Number.isInteger(winnerValue) ? winnerValue : undefined;
  const history = await getAdminHistoryPage({ page, winner });

  return (
    <AdminShell title="Spin History">
      <div className="glass rounded-xl p-5">
        <form className="mb-5 flex flex-wrap gap-3">
          <input
            className="focus-ring h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
            type="number"
            name="winner"
            placeholder="Winner"
            defaultValue={winner ?? ""}
          />
          <button className="gold-button focus-ring rounded-lg px-5 py-2 text-sm uppercase tracking-[0.14em]">Search</button>
        </form>
        {history.items.length === 0 ? (
          <p className="text-[#aeb7ca]">No history found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-[#aeb7ca]">
                <tr>
                  <th className="py-3">Spin ID</th>
                  <th>Date</th>
                  <th>Requested Range</th>
                  <th>Winner</th>
                  <th>Eligible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {history.items.map((item) => (
                  <tr key={item.id} className="text-white">
                    <td className="py-4 font-mono text-xs text-[#aeb7ca]">#{item.id.slice(0, 8).toUpperCase()}</td>
                    <td>{formatInTimeZone(item.createdAt, history.timezone)}</td>
                    <td>
                      {item.requestedMin}-{item.requestedMax}
                    </td>
                    <td className="font-black text-[#f6d98f]">{item.winningNumber}</td>
                    <td>{item.eligibleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-5 text-sm text-[#aeb7ca]">
          Page {history.page} of {history.pageCount}
        </p>
      </div>
    </AdminShell>
  );
}
