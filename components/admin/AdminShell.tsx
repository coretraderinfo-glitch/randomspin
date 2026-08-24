import { BarChart3, History, LayoutDashboard, Lock, LogOut, Settings, Ticket, Users } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { RevokeAllSessionsButton } from "@/components/admin/RevokeAllSessionsButton";

const navItems = [
  { href: "/rs-console/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rs-console/draws", label: "Private Draws", icon: Ticket },
  { href: "/rs-console/player-draws", label: "Player Draws", icon: Users },
  { href: "/rs-console/history", label: "Spin History", icon: History },
  { href: "/rs-console/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/rs-console/security", label: "Security", icon: Lock },
  { href: "/rs-console/settings", label: "Website Settings", icon: Settings }
];

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="premium-shell min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:gap-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8 lg:py-6">
        <aside className="glass h-fit rounded-xl p-4 lg:sticky lg:top-6">
          <BrandMark compact />
          <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-8 lg:grid-cols-1" aria-label="Admin navigation">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="focus-ring flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-[#aeb7ca] transition hover:bg-white/8 hover:text-white lg:gap-3"
              >
                <item.icon className="size-4 shrink-0 text-[#f6d98f]" />
                <span className="min-w-0 leading-tight">{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/10 pt-4">
            <LogoutButton icon={<LogOut className="size-4" />} />
            <RevokeAllSessionsButton icon={<LogOut className="size-4" />} />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#f6d98f]">Private Admin</p>
            <h1 className="mt-2 break-words font-[var(--font-display)] text-3xl font-black text-white sm:text-4xl">{title}</h1>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
