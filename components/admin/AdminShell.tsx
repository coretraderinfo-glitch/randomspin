import { BarChart3, History, LayoutDashboard, LogOut, Settings, SlidersHorizontal, Ticket, Users } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { LogoutButton } from "@/components/admin/LogoutButton";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/wheel", label: "Wheel Control", icon: SlidersHorizontal },
  { href: "/admin/draws", label: "Private Draws", icon: Ticket },
  { href: "/admin/player-draws", label: "Player Draws", icon: Users },
  { href: "/admin/history", label: "Spin History", icon: History },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Website Settings", icon: Settings }
];

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="premium-shell min-h-screen">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="glass h-fit rounded-xl p-4 lg:sticky lg:top-6">
          <BrandMark compact />
          <nav className="mt-8 grid gap-2" aria-label="Admin navigation">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="focus-ring flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-[#aeb7ca] transition hover:bg-white/8 hover:text-white"
              >
                <item.icon className="size-4 text-[#f6d98f]" />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/10 pt-4">
            <LogoutButton icon={<LogOut className="size-4" />} />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#f6d98f]">Private Admin</p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-black text-white">{title}</h1>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
