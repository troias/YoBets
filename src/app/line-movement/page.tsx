import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { PaywallGate } from "@/components/paywall-gate";

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", bet365: "Bet365", ladbrokes: "Ladbrokes",
  neds: "Neds", pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight",
  betr: "Betr", betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

type Movement = {
  matchId: string;
  matchName: string;
  kickoffAt: Date;
  bookmaker: string;
  marketType: string;
  outcome: string;
  openPrice: number;
  closePrice: number;
  changePct: number;
  openRecordedAt: Date;
  closeRecordedAt: Date;
};

export default async function LineMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; window?: string }>;
}) {
  const params = await searchParams;
  const market = (["h2h", "line", "total"].includes(params.market ?? "") ? params.market : "h2h") as MarketType;
  const windowHours = [6, 24, 48].includes(Number(params.window ?? 24)) ? Number(params.window ?? 24) : 24;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60_000);
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  // Fetch all snapshots in the window for upcoming matches
  const matches = await prisma.match.findMany({
    where: { kickoffAt: { gte: now, lte: sevenDaysOut } },
    include: {
      snapshots: {
        where: { recordedAt: { gte: windowStart }, marketType: market as any },
        orderBy: { recordedAt: "asc" },
      },
    },
    orderBy: { kickoffAt: "asc" },
  });

  // Compute opening vs closing price per match/bookmaker/outcome
  const movements: Movement[] = [];

  for (const match of matches) {
    const groups = new Map<string, typeof match.snapshots>();
    for (const snap of match.snapshots) {
      const key = `${snap.bookmaker}|${snap.outcome}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(snap);
    }

    for (const [key, snaps] of groups) {
      if (snaps.length < 2) continue;
      const open = snaps[0];
      const close = snaps[snaps.length - 1];
      const openPrice = Number(open.price);
      const closePrice = Number(close.price);
      const changePct = ((closePrice - openPrice) / openPrice) * 100;
      if (Math.abs(changePct) < 1) continue; // skip tiny moves

      const [bookmaker, outcome] = key.split("|");
      movements.push({
        matchId: match.id,
        matchName: `${match.homeTeam} vs ${match.awayTeam}`,
        kickoffAt: match.kickoffAt,
        bookmaker,
        marketType: open.marketType,
        outcome,
        openPrice,
        closePrice,
        changePct,
        openRecordedAt: open.recordedAt,
        closeRecordedAt: close.recordedAt,
      });
    }
  }

  // Sort by absolute change descending
  movements.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  // Also fetch CLV data: completed matches — closing line vs opening line
  const recentCompleted = await prisma.match.findMany({
    where: {
      kickoffAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60_000), lt: now },
    },
    include: {
      snapshots: {
        where: { marketType: market as any },
        orderBy: { recordedAt: "asc" },
      },
    },
    orderBy: { kickoffAt: "desc" },
    take: 10,
  });

  const clvRows: Movement[] = [];
  for (const match of recentCompleted) {
    const groups = new Map<string, typeof match.snapshots>();
    for (const snap of match.snapshots) {
      const key = `${snap.bookmaker}|${snap.outcome}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(snap);
    }
    for (const [key, snaps] of groups) {
      if (snaps.length < 2) continue;
      const open = snaps[0];
      // Closing = last snapshot before kickoff
      const closing = snaps.filter(s => s.recordedAt <= match.kickoffAt).pop() ?? snaps[snaps.length - 1];
      const openPrice = Number(open.price);
      const closePrice = Number(closing.price);
      const changePct = ((closePrice - openPrice) / openPrice) * 100;
      if (Math.abs(changePct) < 0.5) continue;

      const [bookmaker, outcome] = key.split("|");
      clvRows.push({
        matchId: match.id,
        matchName: `${match.homeTeam} vs ${match.awayTeam}`,
        kickoffAt: match.kickoffAt,
        bookmaker,
        marketType: open.marketType,
        outcome,
        openPrice,
        closePrice,
        changePct,
        openRecordedAt: open.recordedAt,
        closeRecordedAt: closing.recordedAt,
      });
    }
  }
  clvRows.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const windowPills = [
    { label: "6h",  value: "6"  },
    { label: "24h", value: "24" },
    { label: "48h", value: "48" },
  ];

  return (
    <AppShell activePath="/line-movement" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Line Movement</h1>
            <p className="text-sm text-zinc-400">Track odds moves and closing line value</p>
          </div>
          <MarketTabs active={market} basePath="/line-movement" extra={`window=${windowHours}`} />
        </div>

        {/* Window filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Window</span>
          {windowPills.map(p => (
            <a key={p.value} href={`?market=${market}&window=${p.value}`}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${String(windowHours) === p.value ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
              {p.label}
            </a>
          ))}
        </div>

        {/* Upcoming line movers */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Biggest movers — last {windowHours}h
          </h2>
          {movements.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 text-center text-sm text-zinc-500">
              No significant line movement yet. Data builds up as the worker polls each cycle.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Match</th>
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Book</th>
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Outcome</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Open</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Current</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Move</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, i) => {
                    const shortened = m.changePct < 0;
                    return (
                      <tr key={`${m.matchId}-${m.bookmaker}-${m.outcome}`}
                        className={i % 2 === 0 ? "bg-transparent" : "bg-zinc-950/40"}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200">{m.matchName}</div>
                          <div className="text-xs text-zinc-500">
                            {m.kickoffAt.toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} AEST
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{BOOKMAKER_LABEL[m.bookmaker] ?? m.bookmaker}</td>
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap capitalize">{m.outcome}</td>
                        <td className="px-4 py-3 text-center text-zinc-500">{m.openPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-medium text-zinc-100">{m.closePrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${shortened ? "text-red-400" : "text-green-400"}`}>
                            {shortened ? "▼" : "▲"} {Math.abs(m.changePct).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CLV section */}
        <section>
          <h2 className="mb-1 text-sm font-medium text-zinc-300">Closing Line Value — last 7 days</h2>
          <p className="mb-3 text-xs text-zinc-600">Opening odds vs closing odds (just before kickoff). Shortened = sharp money came in.</p>
          {clvRows.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 text-center text-sm text-zinc-500">
              CLV data builds up as matches complete. Check back after a round.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Match</th>
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Book</th>
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Outcome</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Open</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Close</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {clvRows.slice(0, 20).map((m, i) => {
                    const shortened = m.changePct < 0;
                    return (
                      <tr key={`clv-${m.matchId}-${m.bookmaker}-${m.outcome}`}
                        className={i % 2 === 0 ? "bg-transparent" : "bg-zinc-950/40"}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200">{m.matchName}</div>
                          <div className="text-xs text-zinc-500">
                            {m.kickoffAt.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short" })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{BOOKMAKER_LABEL[m.bookmaker] ?? m.bookmaker}</td>
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap capitalize">{m.outcome}</td>
                        <td className="px-4 py-3 text-center text-zinc-500">{m.openPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-medium text-zinc-100">{m.closePrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${shortened ? "text-red-400" : "text-green-400"}`}>
                            {shortened ? "▼" : "▲"} {Math.abs(m.changePct).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
      </PaywallGate>
    </AppShell>
  );
}
