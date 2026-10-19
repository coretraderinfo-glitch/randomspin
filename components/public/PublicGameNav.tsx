"use client";

export function PublicGameNav({ active }: { active: "spin" | "players" }) {
  const items = [
    { href: "/", label: "Number Draw", id: "spin" },
    { href: "/players", label: "Player Draw", id: "players" }
  ] as const;

  return (
    <nav
      className="inline-grid grid-cols-2 overflow-hidden rounded-xl border border-white/12 bg-white/[0.72] p-1 text-sm font-black shadow-[0_8px_24px_rgba(35,59,104,0.08)]"
      aria-label="Game selector"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={`focus-ring flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-center leading-tight transition sm:px-4 ${
            active === item.id ? "bg-[rgba(37,99,235,0.12)] text-white" : "text-[#aeb7ca] hover:bg-white/8 hover:text-white"
          }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
