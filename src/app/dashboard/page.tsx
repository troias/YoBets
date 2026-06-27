import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PaywallGate } from "@/components/paywall-gate";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";

type OddsRow = { bookmaker: string; marketType: string; outcome: string | null; price: number | string; deepLinkUrl?: string; lineValue?: number | string | null };

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", bet365: "Bet365", ladbrokes: "Ladbrokes",
  neds: "Neds", pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight",
  betr: "Betr", betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);

  const [upcomingMatches, liveMatches, recentMoves] = await Promise.all([
    prisma.match.findMany({
      where: { kickoffAt: { gte: now, lte: sevenDaysOut }, status: "upcoming" },
      include: { odds: { where: { marketType: "h2h" } } },
      orderBy: { kickoffAt: "asc" },
    }),
    prisma.match.findMany({
      where: { status: "live" },
      include: { odds: { where: { marketType: "h2h" } } },
      orderBy: { kickoffAt: "asc" },
    }),
    prisma.oddsSnapshot.findMany({
      where: { recordedAt: { gte: new Date(now.getTime() - 2 * 3_600_000) } },
      orderBy: { recordedAt: "desc" },
      take: 200,
      include: { match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } } },
    }),
  ]);

  // Find arbs across all upcoming matches
  const arbs: Array<{ matchName: string; roi: number; bookmakers: string }> = [];
  for (const match of upcomingMatches) {
    const odds = match.odds as unknown as OddsRow[];
    const homeOdds = odds.filter(o => o.outcome === "home");
    const awayOdds = odds.filter(o => o.outcome === "away");
    if (!homeOdds.length || !awayOdds.length) continue;
    const bestHome = homeOdds.reduce((b, o) => Number(o.price) > Number(b.price) ? o : b);
    const bestAway = awayOdds.reduce((b, o) => Number(o.price) > Number(b.price) ? o : b);
    const result = detectTwoWayArbitrage([
      { sportsbook: bestHome.bookmaker, selection: "home", odds: Number(bestHome.price) },
      { sportsbook: bestAway.bookmaker, selection: "away", odds: Number(bestAway.price) },
    ]);
    if (result) {
      arbs.push({
        matchName: `${match.homeTeam} vs ${match.awayTeam}`,
        roi: result.roiPercent,
        bookmakers: `${BOOKMAKER_LABEL[bestHome.bookmaker] ?? bestHome.bookmaker} / ${BOOKMAKER_LABEL[bestAway.bookmaker] ?? bestAway.bookmaker}`,
      });
    }
  }
  arbs.sort((a, b) => b.roi - a.roi);

  // Find top EV bets
  const evBets: Array<{ matchName: string; bookmaker: string; outcome: string; ev: number; odds: number }> = [];
  for (const match of upcomingMatches) {
    const odds2 = match.odds as unknown as OddsRow[];
    const homeOdds = odds2.filter(o => o.outcome === "home");
    const awayOdds = odds2.filter(o => o.outcome === "away");
    if (homeOdds.length < 2 || awayOdds.length < 2) continue;

    const aByBook = new Map(homeOdds.map(o => [o.bookmaker, Number(o.price)]));
    const bByBook = new Map(awayOdds.map(o => [o.bookmaker, Number(o.price)]));
    const shared = [...aByBook.keys()].filter(bm => bByBook.has(bm));
    if (shared.length < 2) continue;

    let sumFairA = 0, sumFairB = 0;
    for (const bm of shared) {
      const p1 = 1 / aByBook.get(bm)!;
      const p2 = 1 / bByBook.get(bm)!;
      const vig = p1 + p2;
      sumFairA += p1 / vig;
      sumFairB += p2 / vig;
    }
    const fairA = sumFairA / shared.length;
    const fairB = sumFairB / shared.length;

    for (const o of homeOdds) {
      const ev = (Number(o.price) * fairA - 1) * 100;
      if (ev > 0) evBets.push({ matchName: `${match.homeTeam} vs ${match.awayTeam}`, bookmaker: BOOKMAKER_LABEL[o.bookmaker] ?? o.bookmaker, outcome: match.homeTeam, ev, odds: Number(o.price) });
    }
    for (const o of awayOdds) {
      const ev = (Number(o.price) * fairB - 1) * 100;
      if (ev > 0) evBets.push({ matchName: `${match.homeTeam} vs ${match.awayTeam}`, bookmaker: BOOKMAKER_LABEL[o.bookmaker] ?? o.bookmaker, outcome: match.awayTeam, ev, odds: Number(o.price) });
    }
  }
  evBets.sort((a, b) => b.ev - a.ev);

  // Detect recent steam moves (>3% price shift in last 2h)
  type SnapRow = typeof recentMoves[0];
  const byKey = new Map<string, SnapRow[]>();
  for (const snap of recentMoves) {
    const k = `${snap.matchId}|${snap.bookmaker}|${snap.marketType}|${snap.outcome}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(snap);
  }

  const steamMoves: Array<{ matchName: string; bookmaker: string; outcome: string; from: number; to: number; pct: number }> = [];
  for (const [, snaps] of byKey) {
    if (snaps.length < 2) continue;
    const oldest = snaps[snaps.length - 1];
    const newest = snaps[0];
    const from = Number(oldest.price);
    const to = Number(newest.price);
    const pct = ((to - from) / from) * 100;
    if (Math.abs(pct) < 3) continue;
    steamMoves.push({
      matchName: `${oldest.match.homeTeam} vs ${oldest.match.awayTeam}`,
      bookmaker: BOOKMAKER_LABEL[oldest.bookmaker] ?? oldest.bookmaker,
      outcome: oldest.outcome,
      from,
      to,
      pct,
    });
  }
  steamMoves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const nextMatch = upcomingMatches[0];
  const checkedAt = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <AppShell activePath="/dashboard" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
        <div className="space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Dashboard</h1>
              <p className="text-sm text-zinc-400">Checked {checkedAt} AEST</p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Live matches", value: liveMatches.length, href: "/live", accent: liveMatches.length > 0 ? "text-green-400" : undefined },
              { label: "Upcoming (7d)", value: upcomingMatches.length, href: "/nrl" },
              { label: "Active arbs", value: arbs.length, href: "/arbitrage", accent: arbs.length > 0 ? "text-green-400" : undefined },
              { label: "+EV bets", value: evBets.length, href: "/ev", accent: evBets.length > 0 ? "text-emerald-400" : undefined },
            ].map(({ label, value, href, accent }) => (
              <Link key={label} href={href} className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 transition hover:border-zinc-700">
                <div className={`text-2xl font-bold ${accent ?? "text-zinc-100"}`}>{value}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
              </Link>
            ))}
          </div>

          {/* Two column layout */}
          <div className="grid gap-4 md:grid-cols-2">

            {/* Arbs */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <span className="text-sm font-medium">Active Arbs</span>
                <Link href="/arbitrage" className="text-xs text-zinc-500 hover:text-zinc-300">View all →</Link>
              </div>
              {arbs.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-600">No arbs right now</p>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {arbs.slice(0, 5).map((arb, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm text-zinc-200">{arb.matchName}</div>
                        <div className="text-xs text-zinc-500">{arb.bookmakers}</div>
                      </div>
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                        +{arb.roi.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top EV */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <span className="text-sm font-medium">Top +EV Bets</span>
                <Link href="/ev" className="text-xs text-zinc-500 hover:text-zinc-300">View all →</Link>
              </div>
              {evBets.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-600">No +EV bets right now</p>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {evBets.slice(0, 5).map((bet, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm text-zinc-200">{bet.outcome}</div>
                        <div className="text-xs text-zinc-500">{bet.bookmaker} · {bet.matchName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-emerald-400">+{bet.ev.toFixed(2)}%</div>
                        <div className="text-xs text-zinc-500">@ {bet.odds.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Steam moves */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <span className="text-sm font-medium">Line Movement (2h)</span>
                <Link href="/line-movement" className="text-xs text-zinc-500 hover:text-zinc-300">Full history →</Link>
              </div>
              {steamMoves.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-600">No significant moves in last 2 hours</p>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {steamMoves.slice(0, 5).map((move, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm text-zinc-200">{move.bookmaker} · {move.outcome}</div>
                        <div className="text-xs text-zinc-500">{move.matchName}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-semibold ${move.pct < 0 ? "text-red-400" : "text-amber-400"}`}>
                          {move.pct > 0 ? "+" : ""}{move.pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-zinc-500">{move.from.toFixed(2)} → {move.to.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next match */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <span className="text-sm font-medium">Next Match</span>
                <Link href="/nrl" className="text-xs text-zinc-500 hover:text-zinc-300">Odds board →</Link>
              </div>
              {!nextMatch ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-600">No upcoming matches</p>
              ) : (
                <div className="px-4 py-4 space-y-3">
                  <div>
                    <div className="font-medium">{nextMatch.homeTeam} vs {nextMatch.awayTeam}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {nextMatch.kickoffAt.toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} AEST
                    </div>
                  </div>
                  {nextMatch.odds.length > 0 && (() => {
                    const matchOdds = nextMatch.odds as unknown as OddsRow[];
                    const homeOdds = matchOdds.filter(o => o.outcome === "home");
                    const awayOdds = matchOdds.filter(o => o.outcome === "away");
                    const bestHome = homeOdds.length ? Math.max(...homeOdds.map(o => Number(o.price))) : null;
                    const bestAway = awayOdds.length ? Math.max(...awayOdds.map(o => Number(o.price))) : null;
                    return (
                      <div className="flex gap-3">
                        <div className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center">
                          <div className="text-xs text-zinc-500">{nextMatch.homeTeam.split(" ").slice(-1)[0]}</div>
                          <div className="mt-0.5 text-lg font-bold text-green-400">{bestHome?.toFixed(2) ?? "—"}</div>
                        </div>
                        <div className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center">
                          <div className="text-xs text-zinc-500">{nextMatch.awayTeam.split(" ").slice(-1)[0]}</div>
                          <div className="mt-0.5 text-lg font-bold text-green-400">{bestAway?.toFixed(2) ?? "—"}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

          </div>
        </div>
      </PaywallGate>
    </AppShell>
  );
}
