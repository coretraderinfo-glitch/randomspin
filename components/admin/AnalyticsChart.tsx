type ChartItem = {
  label: string;
  value: number;
};

export function AnalyticsChart({ title, items }: { title: string; items: ChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <article className="glass rounded-xl p-5">
      <h2 className="mb-5 font-[var(--font-display)] text-2xl font-black text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-[#aeb7ca]">No analytics available yet.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="grid grid-cols-[80px_1fr_48px] items-center gap-3 text-sm">
              <span className="truncate font-bold text-[#aeb7ca]">{item.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-white/8">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#f6d98f] via-[#8d5cff] to-[#57e7ff]"
                  style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
                />
              </span>
              <span className="text-right font-black text-white">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
