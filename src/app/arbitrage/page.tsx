import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";
import { PaywallGate } from "@/components/paywall-gate";

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet",
  tab: "TAB",
  bet365: "Bet365",
  ladbrokes: "Ladbrokes",
  neds: "Neds",
  pointsbet: "PointsBet",
  unibet: "Unibet",
  betright: "BetRight",
  betr: "Betr",
  betfair: "Betfair",
  tabtouch: "TABtouch",
  playup: "PlayUp",
};

type ArbResult = {
  key: string;
  matchName: string;
  kickoffAt: Date;
  roiPercent: number;
  guaranteedReturn: number;
  legs: Array<{
    bookmaker: string;
    outcome: string;
    odds: number;
    stake: number;
    deepLinkUrl: string;
  }>;
};

type OddsRow = {
  bookmaker: string;
  outcome: string;
  price: unknown;
  lineValue: unknown;
  deepLinkUrl: string;
};

function findArbs(
  matchId: string,
  matchName: string,
  kickoffAt: Date,
  homeTeam: string,
  awayTeam: string,
  market: MarketType,
  odds: OddsRow[],
): ArbResult[] {
  const results: ArbResult[] = [];

  if (market === "h2h") {
    const homeOdds = odds.filter((o) => o.outcome === "home");
    const awayOdds = odds.filter((o) => o.outcome === "away");
    if (!homeOdds.length || !awayOdds.length) return [];

    const bestHome = homeOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
    const bestAway = awayOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
    const result = detectTwoWayArbitrage([
      { sportsbook: bestHome.bookmaker, selection: "home", odds: Number(bestHome.price) },
      { sportsbook: bestAway.bookmaker, selection: "away", odds: Number(bestAway.price) },
    ]);
    if (result) {
      results.push({
        key: `${matchId}-h2h`,
        matchName,
        kickoffAt,
        roiPercent: result.roiPercent,
        guaranteedReturn: result.guaranteedReturn,
        legs: [
          { bookmaker: bestHome.bookmaker, outcome: homeTeam, odds: Number(bestHome.price), stake: result.legs[0].stake, deepLinkUrl: bestHome.deepLinkUrl },
          { bookmaker: bestAway.bookmaker, outcome: awayTeam, odds: Number(bestAway.price), stake: result.legs[1].stake, deepLinkUrl: bestAway.deepLinkUrl },
        ],
      });
    }
  }

  if (market === "line") {
    // Group by |lineValue| — each handicap is its own 2-way market
    const byHandicap = new Map<number, { home: OddsRow[]; away: OddsRow[] }>();
    for (const o of odds) {
      const h = Math.abs(Number(o.lineValue));
      if (!byHandicap.has(h)) byHandicap.set(h, { home: [], away: [] });
      if (o.outcome === "home") byHandicap.get(h)!.home.push(o);
      if (o.outcome === "away") byHandicap.get(h)!.away.push(o);
    }
    for (const [handicap, { home: homeOdds, away: awayOdds }] of byHandicap) {
      if (!homeOdds.length || !awayOdds.length) continue;
      const bestHome = homeOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const bestAway = awayOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const result = detectTwoWayArbitrage([
        { sportsbook: bestHome.bookmaker, selection: "home", odds: Number(bestHome.price) },
        { sportsbook: bestAway.bookmaker, selection: "away", odds: Number(bestAway.price) },
      ]);
      if (result) {
        const homeLine = Number(bestHome.lineValue);
        const awayLine = Number(bestAway.lineValue);
        results.push({
          key: `${matchId}-line-${handicap}`,
          matchName,
          kickoffAt,
          roiPercent: result.roiPercent,
          guaranteedReturn: result.guaranteedReturn,
          legs: [
            { bookmaker: bestHome.bookmaker, outcome: `${homeTeam} ${homeLine > 0 ? "+" : ""}${homeLine}`, odds: Number(bestHome.price), stake: result.legs[0].stake, deepLinkUrl: bestHome.deepLinkUrl },
            { bookmaker: bestAway.bookmaker, outcome: `${awayTeam} ${awayLine > 0 ? "+" : ""}${awayLine}`, odds: Number(bestAway.price), stake: result.legs[1].stake, deepLinkUrl: bestAway.deepLinkUrl },
          ],
        });
      }
    }
  }

  if (market === "total") {
    // Group by lineValue — only pair over+under at the same total line
    const byLine = new Map<number, { over: OddsRow[]; under: OddsRow[] }>();
    for (const o of odds) {
      const line = Number(o.lineValue);
      if (!byLine.has(line)) byLine.set(line, { over: [], under: [] });
      if (o.outcome === "over") byLine.get(line)!.over.push(o);
      if (o.outcome === "under") byLine.get(line)!.under.push(o);
    }
    for (const [line, { over: overOdds, under: underOdds }] of byLine) {
      if (!overOdds.length || !underOdds.length) continue;
      const bestOver = overOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const bestUnder = underOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const result = detectTwoWayArbitrage([
        { sportsbook: bestOver.bookmaker, selection: "over", odds: Number(bestOver.price) },
        { sportsbook: bestUnder.bookmaker, selection: "under", odds: Number(bestUnder.price) },
      ]);
      if (result) {
        results.push({
          key: `${matchId}-total-${line}`,
          matchName,
          kickoffAt,
          roiPercent: result.roiPercent,
          guaranteedReturn: result.guaranteedReturn,
          legs: [
            { bookmaker: bestOver.bookmaker, outcome: `Over ${line}`, odds: Number(bestOver.price), stake: result.legs[0].stake, deepLinkUrl: bestOver.deepLinkUrl },
            { bookmaker: bestUnder.bookmaker, outcome: `Under ${line}`, odds: Number(bestUnder.price), stake: result.legs[1].stake, deepLinkUrl: bestUnder.deepLinkUrl },
          ],
        });
      }
    }
  }

  return results;
}

function aestDateRange(option: string, now: Date): { gte: Date; lte: Date } {
  const AEST = 10 * 60 * 60 * 1000;
  const aestNow = new Date(now.getTime() + AEST);
  const todayStartUTC = new Date(
    Date.UTC(aestNow.getUTCFullYear(), aestNow.getUTCMonth(), aestNow.getUTCDate()) - AEST
  );
  const tomorrow = new Date(todayStartUTC.getTime() + 86_400_000);
  const dayAfter  = new Date(todayStartUTC.getTime() + 172_800_000);
  if (option === "today")    return { gte: now, lte: tomorrow };
  if (option === "tomorrow") return { gte: tomorrow, lte: dayAfter };
  return { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) };
}

export default async function ArbitragePage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; date?: string; minRoi?: string }>;
}) {
  const params = await searchParams;
  const market = (
    ["h2h", "line", "total"].includes(params.market ?? "") ? params.market : "h2h"
  ) as MarketType;
  const date   = ["today", "tomorrow", "all"].includes(params.date ?? "") ? (params.date ?? "all") : "all";
  const minRoi = Math.max(0, Number(params.minRoi ?? 0));

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const { gte, lte } = aestDateRange(date, now);

  const matches = await prisma.match.findMany({
    where: { kickoffAt: { gte, lte } },
    include: { odds: { where: { marketType: market } } },
    orderBy: { kickoffAt: "asc" },
  });

  const arbs: ArbResult[] = [];
  for (const match of matches) {
    arbs.push(
      ...findArbs(
        match.id,
        `${match.homeTeam} vs ${match.awayTeam}`,
        match.kickoffAt,
        match.homeTeam,
        match.awayTeam,
        market,
        match.odds,
      ),
    );
  }
  const filtered = arbs.filter(a => a.roiPercent >= minRoi).sort((a, b) => b.roiPercent - a.roiPercent);

  const checkedAt = now.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const roiFilters = [
    { label: "Any",   value: "0"   },
    { label: "0.5%+", value: "0.5" },
    { label: "1%+",   value: "1"   },
    { label: "2%+",   value: "2"   },
  ];

  const datePills = [
    { label: "Today",    value: "today"    },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "All",      value: "all"      },
  ];

  return (
    <AppShell activePath="/arbitrage" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Arb Finder</h1>
            <p className="text-sm text-zinc-400">2-way arbitrage · NRL next 7 days</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-zinc-600">Checked {checkedAt} AEST</span>
            <MarketTabs active={market} basePath="/arbitrage" extra={`date=${date}&minRoi=${minRoi}`} />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Date</span>
            {datePills.map(p => (
              <a key={p.value} href={`?market=${market}&date=${p.value}&minRoi=${minRoi}`}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${date === p.value ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {p.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Min ROI</span>
            {roiFilters.map(f => (
              <a key={f.value} href={`?market=${market}&date=${date}&minRoi=${f.value}`}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${String(minRoi) === f.value ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {f.label}
              </a>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-10 text-center">
            <p className="text-sm font-medium text-zinc-300">No arbitrage opportunities right now</p>
            <p className="mt-1 text-xs text-zinc-500">
              Arbs appear when bookmakers disagree enough to guarantee profit. Check back during match windows.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((arb) => {
              const kickoff = arb.kickoffAt.toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
              return (
                <div key={arb.key} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <div>
                      <div className="font-medium">{arb.matchName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-sm font-semibold text-green-400">
                        +{arb.roiPercent.toFixed(2)}%
                      </span>
                      <span className="text-xs text-zinc-500">
                        ${arb.guaranteedReturn.toFixed(2)} return on $100
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {arb.legs.map((leg) => (
                      <div key={leg.bookmaker + leg.outcome} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs text-zinc-500">
                            {BOOKMAKER_LABEL[leg.bookmaker] ?? leg.bookmaker}
                          </span>
                          <span className="text-sm text-zinc-200">{leg.outcome}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-zinc-100">@ {leg.odds.toFixed(2)}</div>
                            <div className="text-xs text-zinc-500">Stake ${leg.stake.toFixed(2)}</div>
                          </div>
                          <a
                            href={leg.deepLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
                          >
                            Bet →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </PaywallGate>
    </AppShell>
  );
}
