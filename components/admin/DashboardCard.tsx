type DashboardCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

export function DashboardCard({ label, value, detail }: DashboardCardProps) {
  return (
    <article className="glass rounded-xl p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#aeb7ca]">{label}</p>
      <p className="gold-text mt-3 font-[var(--font-display)] text-4xl font-black">{value}</p>
      {detail ? <p className="mt-2 text-sm text-[#aeb7ca]">{detail}</p> : null}
    </article>
  );
}
