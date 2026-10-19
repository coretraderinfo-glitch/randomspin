type RecentResult = {
  winner: number;
  timestamp?: string;
};

export function RecentResults({ results }: { results: RecentResult[] }) {
  return (
    <section className="w-full" aria-labelledby="recent-results">
      <h2 id="recent-results" className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#aeb7ca]">
        Recent Results
      </h2>
      {results.length === 0 ? (
        <p className="event-panel rounded-xl px-4 py-3 text-sm text-[#aeb7ca]">
          Your first result will appear here.
        </p>
      ) : (
        <div className="event-panel flex max-h-[7.75rem] flex-wrap gap-2 overflow-y-auto rounded-xl p-2 pr-1 sm:max-h-none sm:overflow-visible sm:p-3 sm:pr-3">
          {results.map((result, index) => (
            <span
              key={`${result.winner}-${result.timestamp ?? index}`}
              className="grid size-11 place-items-center rounded-lg border border-[rgba(37,99,235,0.18)] bg-[rgba(37,99,235,0.08)] text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            >
              {result.winner}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
