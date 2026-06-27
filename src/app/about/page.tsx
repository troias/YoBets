import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "About EdgeBoard — Built for Australian NRL Bettors",
  description: "EdgeBoard was built because checking odds across 12 bookmaker tabs is exhausting. One Australian bettor's tool, now available to everyone.",
};

export default async function AboutPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell activePath="/about" userEmail={user?.email}>
      <div className="max-w-2xl space-y-8">

        <div>
          <h1 className="text-2xl font-semibold">About EdgeBoard</h1>
          <p className="mt-2 text-zinc-400">Built for Australian NRL bettors who want an edge, not a bigger screen.</p>
        </div>

        {/* Origin */}
        <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
          <p>
            EdgeBoard started as a personal tool. I was tired of having 12 browser tabs open before every game — Sportsbet, TAB, Ladbrokes, Neds, the lot — just to find out who had the best price on the Storm. Most of the time I was betting at slightly worse odds than I could have been getting, and I didn&apos;t even know it.
          </p>
          <p>
            I built a script to pull odds from all the major Australian bookmakers into one place. Then I added arbitrage detection. Then expected value. Then line movement tracking, so I could see when sharp money was coming in on a side I was about to bet against.
          </p>
          <p>
            After a few months of using it myself, I figured other NRL bettors would find it useful. So I cleaned it up, added alerts so you don&apos;t have to keep checking manually, and launched it.
          </p>
          <p>
            That&apos;s EdgeBoard — one person&apos;s tool, available to everyone.
          </p>
        </div>

        <hr className="border-zinc-800" />

        {/* How it works */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">How it works</h2>
          <div className="space-y-3 text-sm text-zinc-400">
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-amber-400 font-bold">1.</span>
              <p><span className="text-zinc-200 font-medium">Live odds from 12 bookmakers.</span> A background worker polls all major Australian bookmakers continuously — every 2 minutes in the 3 hours before kickoff, every 5–15 minutes further out. Prices are always current when it matters most.</p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-amber-400 font-bold">2.</span>
              <p><span className="text-zinc-200 font-medium">Arb detection.</span> Every poll cycle, we check every bookmaker pair for each match. If the combined implied probability drops below 100%, that&apos;s a guaranteed profit. We find it and surface it instantly.</p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-amber-400 font-bold">3.</span>
              <p><span className="text-zinc-200 font-medium">Expected value.</span> We de-vig the market using a consensus of all available bookmakers to build a fair odds model. Any price that beats fair probability has positive expected value. We find those and rank them.</p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-amber-400 font-bold">4.</span>
              <p><span className="text-zinc-200 font-medium">Line movement.</span> Every price change is recorded. We track the direction and speed of moves across all books — steam moves (fast, multi-book drops) are the signature of sharp money and tell you where to look.</p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-amber-400 font-bold">5.</span>
              <p><span className="text-zinc-200 font-medium">Alerts.</span> Pro subscribers get push, email, or SMS the second something hits their threshold — a price target, a +EV bet, a steam move, or an arb. By the time you check manually, the window is often already closed.</p>
            </div>
          </div>
        </div>

        <hr className="border-zinc-800" />

        {/* Bookmakers */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Bookmakers covered</h2>
          <p className="text-sm text-zinc-400">All major licensed Australian bookmakers:</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Sportsbet","TAB","Ladbrokes","Neds","PointsBet","Unibet","BetRight","Betr","Betfair","TABtouch","PlayUp","Bet365*"].map(bm => (
              <span key={bm} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300">{bm}</span>
            ))}
          </div>
          <p className="text-xs text-zinc-600">* Bet365 data is sourced separately and may be slightly delayed. It is excluded from best-price calculations and the EV model.</p>
        </div>

        <hr className="border-zinc-800" />

        {/* Transparency */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">Transparency</h2>
          <div className="space-y-2 text-sm text-zinc-400">
            <p><span className="text-zinc-200 font-medium">Affiliate links.</span> When you click a price and sign up to a bookmaker through EdgeBoard, we earn a commission. This does not affect the prices we display — odds are fetched directly from each bookmaker&apos;s API, not influenced by any commercial arrangement.</p>
            <p><span className="text-zinc-200 font-medium">No predictions.</span> EdgeBoard does not tip or predict match outcomes. Everything shown — arbs, EV, line movement — is derived from what the market is doing right now, not editorial opinion.</p>
            <p><span className="text-zinc-200 font-medium">Gambling responsibly.</span> Betting should be enjoyable. If it&apos;s causing stress, <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 transition">Gambling Help Online</a> is free, confidential, and available 24/7 on 1800 858 858.</p>
          </div>
        </div>

        <hr className="border-zinc-800" />

        {/* CTA */}
        {!user && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-200">Try it free — no card needed</p>
            <p className="text-xs text-zinc-500">Full access to the odds board, arb finder, EV finder, and line movement tracker.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/register" className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400">
                Create free account →
              </Link>
              <Link href="/nrl" className="text-sm text-zinc-400 hover:text-zinc-200 transition">
                See live odds
              </Link>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
