import Link from "next/link";
import { BarChart2, Shield, TrendingUp, Settings, LayoutDashboard, Radio, Activity, BookOpen, Gift, Zap, ShieldCheck, Home } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SignOutButton } from "@/components/auth/sign-out-button";

const navItems = [
  { href: "/dashboard",           label: "Dashboard",      icon: LayoutDashboard },
  { href: "/brief",               label: "Market Brief",   icon: Zap },
  { href: "/nrl",                 label: "Odds Board",     icon: Shield },
  { href: "/live",                label: "Live",           icon: Radio },
  { href: "/arbitrage",           label: "Arb Finder",     icon: TrendingUp },
  { href: "/ev",                  label: "EV Finder",      icon: BarChart2 },
  { href: "/line-movement",       label: "Line Movement",  icon: Activity },
  { href: "/free-bet-converter",  label: "Free Bet Calc",  icon: Gift },
  { href: "/bets",                label: "Bet Tracker",    icon: BookOpen },
  { href: "/settings",            label: "Settings",       icon: Settings },
];

// 5 core items pinned to the mobile bottom tab bar
const mobileTabItems = [
  { href: "/dashboard", label: "Home",  icon: Home },
  { href: "/brief",     label: "Brief", icon: Zap },
  { href: "/nrl",       label: "Odds",  icon: Shield },
  { href: "/live",      label: "Live",  icon: Radio },
  { href: "/arbitrage", label: "Arb",   icon: TrendingUp },
];

export function AppShell({
  children,
  activePath,
  userEmail,
}: {
  children: React.ReactNode;
  activePath: string;
  userEmail?: string;
}) {
  const isAdmin = userEmail === process.env.ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-1.5 font-semibold tracking-tight hover:text-zinc-300 transition">
          <Home className="h-4 w-4 shrink-0" />
          EdgeBoard
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin"
              className={cn("text-xs font-medium transition", activePath.startsWith("/admin") ? "text-amber-400" : "text-amber-600 hover:text-amber-400")}>
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      {/* Desktop layout */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 md:grid-cols-[220px_1fr] md:px-6">

        {/* Desktop sidebar */}
        <aside className="hidden flex-col rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 md:flex">
          <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight hover:text-zinc-300 transition">
            <Home className="h-5 w-5 shrink-0" />
            EdgeBoard
          </Link>
          <nav className="flex-1 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  activePath.startsWith(href)
                    ? "bg-amber-500/10 text-amber-300 font-medium"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  activePath.startsWith("/admin")
                    ? "bg-amber-900/40 text-amber-300"
                    : "text-amber-600 hover:bg-amber-900/20 hover:text-amber-400",
                )}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Admin
              </Link>
            )}
          </nav>
          <div className="mt-4 border-t border-zinc-800 pt-4">
            {userEmail && (
              <p className="truncate px-2 pb-1 text-xs text-zinc-500">{userEmail}</p>
            )}
            <SignOutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="pb-24 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar — 5 core items */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-800 bg-zinc-950 md:hidden">
        {mobileTabItems.map(({ href, label, icon: Icon }) => {
          const active = activePath.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] transition",
                active ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-zinc-100")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
