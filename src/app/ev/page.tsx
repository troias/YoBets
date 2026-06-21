import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
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

// Boosted/promo products (Betbooster, Odds Boost, Power Play) are excluded
// from the consensus fair odds model — tagged here when Bet365 scraping is added.
const EXCLUDE_FROM_CONSENSUS = new Set<string>([]);

type EVRow = {
  key: string;
  matchName: string;
  kickoffAt: Date;
  bookmaker: string;
  outcome: string;
  offeredOdds: number;
  fairOdds: number;
  evPercent: number;
  deepLinkUrl: string;
};

function deVigFairProbs(p1Odds: number, p2Odds: number): [number, number] {
  const p1 = 1 / p1Odds;
  const p2 = 1 / p2Odds;
  const vig = p1 + p2;
  return [p1 / vig, p2 / vig];
}

function computeEV(
  matchId: string,
  matchName: string,
  kickoffAt: Date,
  homeTeam: string,
  awayTeam: string,
  market: MarketType,
  odds: Array<{ bookmaker: string; outcome: string; price: unknown; lineValue: unknown; deepLinkUrl: string }>,
  minEv: number,
): EVRow[] {
  const rows: EVRow[] = [];

  const sideA = market === "total" ? "over" : "home";
  const sideB = market === "total" ? "under" : "away";

  // Group by lineValue bucket so we only compare same-line prices
  const lineGroups = new Map<string, { a: typeof odds; b: typeof odds }>();

  for (const o of odds) {
    // Normalise the key: for h2h there's no lineValue; for line use |value|; for total use value
    const lineKey =
      market === "h2h"
        ? "h2h"
        : market === "line"
        ? String(Math.abs(Number(o.lineValue)))
        : String(Number(o.lineValue));

    if (!lineGroups.has(lineKey)) lineGroups.set(lineKey, { a: [], b: [] });
    if (o.outcome === sideA) lineGroups.get(lineKey)!.a.push(o);
    if (o.outcome === sideB) lineGroups.get(lineKey)!.b.push(o);
  }

  for (const [lineKey, { a: aOdds, b: bOdds }] of lineGroups) {
    if (aOdds.length < 1 || bOdds.length < 1) continue;

    // Build consensus: de-vig each book pair that has both sides
    const aByBook = new Map(aOdds.map((o) => [o.bookmaker, o]));
    const bByBook = new Map(bOdds.map((o) => [o.bookmaker, o]));
    const consensusBooks = [...aByBook.keys()].filter(
      (bm) => bByBook.has(bm) && !EXCLUDE_FROM_CONSENSUS.has(bm),
    );

    if (consensusBooks.length < 2) continue;

    let sumFairA = 0;
    let sumFairB = 0;
    for (const bm of consensusBooks) {
      const [fa, fb] = deVigFairProbs(
        Number(aByBook.get(bm)!.price),
        Number(bByBook.get(bm)!.price),
      );
      sumFairA += fa;
      sumFairB += fb;
    }
    const fairProbA = sumFairA / consensusBooks.length;
    const fairProbB = sumFairB / consensusBooks.length;
    const fairOddsA = 1 / fairProbA;
    const fairOddsB = 1 / fairProbB;

    const outcomeLabel = (outcome: string, lineValue: unknown) => {
      if (market === "h2h") return outcome === "home" ? homeTeam : awayTeam;
      if (market === "line") {
        const team = outcome === "home" ? homeTeam : awayTeam;
        const lv = Number(lineValue);
        return `${team} ${lv > 0 ? "+" : ""}${lv}`;
      }
      return outcome === "over" ? `Over ${Number(lineValue)}` : `Under ${Number(lineValue)}`;
    };

    for (const o of aOdds) {
      const ev = (Number(o.price) * fairProbA - 1) * 100;
      if (ev >= minEv) {
        rows.push({
          key: `${matchId}-${o.bookmaker}-${sideA}-${lineKey}`,
          matchName,
          kickoffAt,
          bookmaker: o.bookmaker,
          outcome: outcomeLabel(sideA, o.lineValue),
          offeredOdds: Number(o.price),
          fairOdds: fairOddsA,
          evPercent: ev,
          deepLinkUrl: o.deepLinkUrl,
        });
      }
    }

    for (const o of bOdds) {
      const ev = (Number(o.price) * fairProbB - 1) * 100;
      if (ev >= minEv) {
        rows.push({
          key: `${matchId}-${o.bookmaker}-${sideB}-${lineKey}`,
          matchName,
          kickoffAt,
          bookmaker: o.bookmaker,
          outcome: outcomeLabel(sideB, o.lineValue),
          offeredOdds: Number(o.price),
          fairOdds: fairOddsB,
          evPercent: ev,
          deepLinkUrl: o.deepLinkUrl,
        });
      }
    }
  }

  return rows;
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

export default async function EVPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; minEv?: string; date?: string }>;
}) {
  const params = await searchParams;
  const market = (
    ["h2h", "line", "total"].includes(params.market ?? "") ? params.market : "h2h"
  ) as MarketType;
  const minEv = Math.max(0, Number(params.minEv ?? 0));
  const date  = ["today", "tomorrow", "all"].includes(params.date ?? "") ? (params.date ?? "all") : "all";

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

  const evRows: EVRow[] = [];
  for (const match of matches) {
    evRows.push(
      ...computeEV(
        match.id,
        `${match.homeTeam} vs ${match.awayTeam}`,
        match.kickoffAt,
        match.homeTeam,
        match.awayTeam,
        market,
        match.odds,
        minEv,
      ),
    );
  }
  evRows.sort((a, b) => b.evPercent - a.evPercent);

  const checkedAt = now.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const evFilters = [
    { label: "All", value: "0" },
    { label: "+1%", value: "1" },
    { label: "+2%", value: "2" },
    { label: "+5%", value: "5" },
  ];

  return (
    <AppShell activePath="/ev" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">EV Finder</h1>
            <p className="text-sm text-zinc-400">
              Positive expected value · No-vig consensus line · NRL next 7 days
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-zinc-600">Checked {checkedAt} AEST</span>
            <MarketTabs active={market} basePath="/ev" extra={`date=${date}&minEv=${minEv}`} />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Date</span>
            {[{ label: "Today", value: "today" }, { label: "Tomorrow", value: "tomorrow" }, { label: "All", value: "all" }].map(p => (
              <a key={p.value} href={`?market=${market}&date=${p.value}&minEv=${minEv}`}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${date === p.value ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {p.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Min EV</span>
            {evFilters.map((f) => {
              const active = String(minEv) === f.value || (f.value === "0" && !params.minEv);
              return (
                <a key={f.value} href={`?market=${market}&date=${date}&minEv=${f.value}`}
                  className={`rounded-lg px-3 py-1.5 text-xs transition ${active ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                  {f.label}
                </a>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          Boosted/promo prices (Betbooster, Odds Boost, Power Play) are excluded from the fair odds model.
        </p>

        {evRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-10 text-center">
            <p className="text-sm font-medium text-zinc-300">
              No bets above +{minEv}% EV right now
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Try lowering the threshold, switching markets, or check back when odds move closer to kick-off.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Match</th>
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Outcome</th>
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Book</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Offered</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Fair</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">EV</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {evRows.map((row, i) => {
                  const kickoff = row.kickoffAt.toLocaleString("en-AU", {
                    timeZone: "Australia/Sydney",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  });
                  return (
                    <tr
                      key={row.key}
                      className={i % 2 === 0 ? "bg-transparent" : "bg-zinc-950/40"}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-200">{row.matchName}</div>
                        <div className="text-xs text-zinc-500">{kickoff}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{row.outcome}</td>
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {BOOKMAKER_LABEL[row.bookmaker] ?? row.bookmaker}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-zinc-100">
                        {row.offeredOdds.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500">
                        {row.fairOdds.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            row.evPercent >= 3
                              ? "text-green-400"
                              : row.evPercent >= 1
                              ? "text-emerald-500"
                              : "text-zinc-300"
                          }`}
                        >
                          +{row.evPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={row.deepLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
                        >
                          Bet →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </PaywallGate>
    </AppShell>
  );
}
