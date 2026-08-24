type RecentResult = {
  winner: number;
  timestamp?: string;
};

export function RecentResults({ results }: { results: RecentResult[] }) {
  return (
    <section className="w-full" aria-labelledby="recent-results">
      <h2 id="recent-results" className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-[#aeb7ca]">
        Recent Results
      </h2>
      {results.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#aeb7ca]">
          Your first result will appear here.
        </p>
      ) : (
        <div className="flex max-h-[7.75rem] flex-wrap gap-2 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
          {results.map((result, index) => (
            <span
              key={`${result.winner}-${result.timestamp ?? index}`}
              className="grid size-11 place-items-center rounded-lg border border-[rgba(246,217,143,0.26)] bg-[rgba(246,217,143,0.08)] text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              {result.winner}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
