import Link from "next/link";
import { Activity, Bell, Gauge, Shield, Siren, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/ev", label: "EV", icon: Target },
  { href: "/arbitrage", label: "Arbitrage", icon: Siren },
  { href: "/nrl", label: "NRL", icon: Shield },
  { href: "/settings", label: "Alerts", icon: Bell },
];

export function AppShell({ children, activePath }: { children: React.ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-3">
          <div className="mb-4 px-2 text-lg font-semibold">EdgeBoard</div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition",
                  activePath === href ? "bg-zinc-800 text-zinc-100" : "hover:bg-zinc-900 hover:text-zinc-200",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
