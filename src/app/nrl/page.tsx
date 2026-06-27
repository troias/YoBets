import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { PaywallGate } from "@/components/paywall-gate";
import { NextPollCountdown } from "@/components/next-poll-countdown";
import { PriceAlertButton } from "@/components/price-alert-button";

type OddsRow = { bookmaker: string; marketType: string; outcome: string | null; price: number | string; deepLinkUrl?: string; lineValue?: number | string | null; updatedAt: Date };
type SnapRow  = { matchId: string; bookmaker: string; outcome: string | null; price: number | string };
type NrlMatchRow = { id: string; homeTeam: string; awayTeam: string; kickoffAt: Date; status: string; sport: string; odds: OddsRow[] };

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet",
  tab:       "TAB",
  bet365:    "Bet365",
  ladbrokes: "Ladbrokes",
  neds:      "Neds",
  pointsbet: "PointsBet",
  unibet:    "Unibet",
  betright:  "BetRight",
  betr:      "Betr",
  betfair:   "Betfair",
  tabtouch:  "TABtouch",
  playup:    "PlayUp",
};

// Live API bookmakers — default set shown to all users
const LIVE_BOOKMAKERS = ["sportsbet", "tab", "ladbrokes", "neds", "pointsbet", "unibet", "betright", "betr", "betfair", "tabtouch", "playup"];
// Scraped from a third-party site, not a live API — may be hours stale
const STALE_BOOKS = new Set(["bet365"]);
const ALL_BOOKMAKERS = LIVE_BOOKMAKERS; // kept for compat

function outcomeLabel(market: MarketType, outcome: string, teamName: string, lineValue: number | null): string {
  if (market === "h2h") return teamName.split(" ").slice(-1)[0];
  if (market === "line") {
    const sign = lineValue !== null && lineValue > 0 ? "+" : "";
    return `${teamName.split(" ").slice(-1)[0]} ${sign}${lineValue ?? ""}`;
  }
  return outcome === "over" ? "Over" : "Under";
}

function cellLabel(market: MarketType, price: number, lineValue: number | null): string {
  if (market === "h2h") return price.toFixed(2);
  if (market === "line") {
    const sign = lineValue !== null && lineValue > 0 ? "+" : "";
    return `${sign}${lineValue} @ ${price.toFixed(2)}`;
  }
  return `${lineValue} @ ${price.toFixed(2)}`;
}

const MARKET_OUTCOMES: Record<MarketType, string[]> = {
  h2h:   ["home", "away"],
  line:  ["home", "away"],
  total: ["over", "under"],
};

// AEST = UTC+10 (no DST in June–September)
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

function pill(label: string, href: string, active: boolean) {
  return { label, href, active };
}

export default async function NRLPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; date?: string; team?: string; books?: string }>;
}) {
  const params = await searchParams;

  const market = (["h2h", "line", "total"].includes(params.market ?? "") ? params.market : "h2h") as MarketType;
  const date   = ["today", "tomorrow", "all"].includes(params.date ?? "") ? (params.date ?? "all") : "all";
  const team   = params.team?.trim() ?? "";

  // Bookmaker filter: parse from param, fall back to all live books (bet365 off by default)
  const validBooks   = [...LIVE_BOOKMAKERS, "bet365"];
  const booksParam   = params.books?.split(",").filter(b => validBooks.includes(b)) ?? [];
  const activeBooks  = booksParam.length > 0 ? booksParam : [...LIVE_BOOKMAKERS];
  const usingDefault = booksParam.length === 0;
  const allSelected  = usingDefault; // alias for compat
  const staleActive  = activeBooks.includes("bet365");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const { gte, lte } = aestDateRange(date, now);

  // Build the base query params string (everything except the filter being toggled)
  function u(overrides: Record<string, string>) {
    const base = { market, date, team, books: allSelected ? "" : activeBooks.join(",") };
    const merged = { ...base, ...overrides };
    const sp = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== ""));
    return `/nrl?${sp.toString()}`;
  }

  // Bookmaker toggle: clicking a live bookmaker adds/removes from activeBooks
  function toggleBook(bm: string) {
    const isActive = activeBooks.includes(bm);
    let newBooks: string[];
    if (isActive) {
      newBooks = activeBooks.filter(b => b !== bm);
      if (newBooks.filter(b => !STALE_BOOKS.has(b)).length === 0) newBooks = [...LIVE_BOOKMAKERS]; // keep at least one live book
    } else {
      newBooks = [...activeBooks, bm];
    }
    const isDefault = LIVE_BOOKMAKERS.every(b => newBooks.includes(b)) && !newBooks.some(b => STALE_BOOKS.has(b));
    return u({ books: isDefault ? "" : newBooks.join(",") });
  }

  // Stale opt-in toggle for bet365
  function toggleStale() {
    if (staleActive) {
      const newBooks = activeBooks.filter(b => !STALE_BOOKS.has(b));
      const isDefault = LIVE_BOOKMAKERS.every(b => newBooks.includes(b));
      return u({ books: isDefault ? "" : newBooks.join(",") });
    }
    return u({ books: [...activeBooks, "bet365"].join(",") });
  }

  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: { gte, lte },
      ...(team ? {
        OR: [
          { homeTeam: { contains: team, mode: "insensitive" } },
          { awayTeam: { contains: team, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      odds: {
        where: { marketType: market, bookmaker: { in: activeBooks as any[] } },
        orderBy: { bookmaker: "asc" },
      },
    },
    orderBy: { kickoffAt: "asc" },
  }) as unknown as NrlMatchRow[];

  // Snapshots from ~1h ago — used to show ▲▼ movement on each cell
  const matchIds = matches.map(m => m.id);
  const snapshots = matchIds.length > 0
    ? (await prisma.oddsSnapshot.findMany({
        where: {
          matchId: { in: matchIds },
          marketType: market,
          bookmaker: { in: activeBooks as any[] },
          recordedAt: { gte: new Date(now.getTime() - 75 * 60_000), lte: new Date(now.getTime() - 45 * 60_000) },
        },
        select: { matchId: true, bookmaker: true, outcome: true, price: true },
        orderBy: { recordedAt: "desc" },
      })) as unknown as SnapRow[]
    : [];

  // One price per cell — most recent within the window
  const prevPriceMap = new Map<string, number>();
  for (const s of snapshots) {
    const key = `${s.matchId}|${s.bookmaker}|${s.outcome}`;
    if (!prevPriceMap.has(key)) prevPriceMap.set(key, Number(s.price));
  }

  // Price alerts set by this user — show bell state in the table
  const userAlerts = user
    ? await prisma.priceAlert.findMany({
        where: { userId: user.id, firedAt: null, matchId: { in: matchIds } },
        select: { id: true, matchId: true, outcome: true, targetPrice: true },
      })
    : [];
  const alertMap = new Map(userAlerts.map(a => [`${a.matchId}|${a.outcome}`, a]));

  // Next poll scheduled time — written by the worker after each cycle
  const nextPollConfig = await prisma.appConfig.findUnique({ where: { key: "next_poll_at" } });
  const nextPollAt = nextPollConfig?.value ?? null;

  // Last refreshed: newest updatedAt across all fetched odds
  let latestUpdate: Date | null = null;
  for (const m of matches) {
    for (const o of m.odds) {
      if (!latestUpdate || o.updatedAt > latestUpdate) latestUpdate = o.updatedAt;
    }
  }
  const minutesAgo = latestUpdate ? Math.round((Date.now() - latestUpdate.getTime()) / 60_000) : null;
  const freshLabel = minutesAgo === null ? null
    : minutesAgo < 2  ? "just now"
    : minutesAgo < 60 ? `${minutesAgo}m ago`
    : `${Math.round(minutesAgo / 60)}h ago`;

  const outcomes = MARKET_OUTCOMES[market];
  const datePills = [
    pill("Today",    u({ date: "today",    books: allSelected ? "" : activeBooks.join(",") }), date === "today"),
    pill("Tomorrow", u({ date: "tomorrow", books: allSelected ? "" : activeBooks.join(",") }), date === "tomorrow"),
    pill("All",      u({ date: "all",      books: allSelected ? "" : activeBooks.join(",") }), date === "all"),
  ];

  return (
    <AppShell activePath="/nrl" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
      <div className="space-y-4">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">NRL Odds Board</h1>
            <p className="text-sm text-zinc-400 flex flex-wrap items-center gap-x-2">
              12 bookmakers · next 7 days
              {freshLabel && <span className="text-zinc-600">· updated {freshLabel}</span>}
              {nextPollAt && (
                <>
                  <span className="text-zinc-700">·</span>
                  <NextPollCountdown nextPollAt={nextPollAt} />
                </>
              )}
            </p>
          </div>
          <MarketTabs active={market} basePath="/nrl" extra={`date=${date}${team ? `&team=${encodeURIComponent(team)}` : ""}${!allSelected ? `&books=${activeBooks.join(",")}` : ""}`} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">

          {/* Date pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Date</span>
            {datePills.map(p => (
              <a key={p.label} href={p.href}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${p.active ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {p.label}
              </a>
            ))}
          </div>

          {/* Team search */}
          <form method="get" action="/nrl" className="flex items-center gap-1.5">
            <input type="hidden" name="market" value={market} />
            <input type="hidden" name="date" value={date} />
            {!usingDefault && <input type="hidden" name="books" value={activeBooks.join(",")} />}
            <input
              type="text"
              name="team"
              defaultValue={team}
              placeholder="Search team…"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 w-36"
            />
            {team && (
              <a href={u({ team: "" })} className="text-xs text-zinc-500 hover:text-zinc-300">✕</a>
            )}
          </form>
        </div>

        {/* Bookmaker toggles — scrollable row */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-zinc-500">Books</span>
            <a href={u({ books: "" })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${usingDefault ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
              All
            </a>
            {LIVE_BOOKMAKERS.map(bm => {
              const active = activeBooks.includes(bm);
              return (
                <a key={bm} href={toggleBook(bm)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${active && !usingDefault ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                  {BOOKMAKER_LABEL[bm]}
                </a>
              );
            })}
            <a href={toggleStale()}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition border ${staleActive ? "border-amber-700/50 bg-amber-900/20 text-amber-400" : "border-dashed border-zinc-700 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"}`}>
              {staleActive ? "Bet365 ⚠" : "+ Bet365"}
            </a>
          </div>
          {staleActive && (
            <p className="text-[11px] text-amber-700">
              ⚠ Bet365 data is scraped from a third-party site and may be hours out of date — not used for best-price highlighting. For live Bet365 data, upgrade to OddsJam API.
            </p>
          )}
        </div>

        {/* Results */}
        {matches.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-10 text-center text-sm text-zinc-500">
            No matches found.
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const teamForOutcome: Record<string, string> = {
                home: match.homeTeam, away: match.awayTeam, over: "Over", under: "Under",
              };
              const matchOdds = match.odds as unknown as OddsRow[];
              const bookmakers = [...new Set(matchOdds.map(o => o.bookmaker))];
              const bestByOutcome: Record<string, number> = {};
              for (const outcome of outcomes) {
                // Exclude stale books from best-price highlighting — their data can be hours old
                const liveRows = matchOdds.filter(o => o.outcome === outcome && !STALE_BOOKS.has(o.bookmaker));
                bestByOutcome[outcome] = liveRows.length ? Math.max(...liveRows.map(o => Number(o.price))) : 0;
              }
              // Hot match: any outcome has >8% spread across live bookmakers
              const liveOdds = matchOdds.filter(o => !STALE_BOOKS.has(o.bookmaker));
              const isHot = outcomes.some(oc => {
                const prices = liveOdds.filter(o => o.outcome === oc).map(o => Number(o.price));
                if (prices.length < 2) return false;
                const mn = Math.min(...prices), mx = Math.max(...prices);
                return (mx - mn) / mn * 100 >= 8;
              });

              const kickoff = match.kickoffAt.toLocaleString("en-AU", {
                timeZone: "Australia/Sydney", weekday: "short", day: "numeric",
                month: "short", hour: "numeric", minute: "2-digit", hour12: true,
              });
              if (!bookmakers.length) return null;
              return (
                <div key={match.id} className={`overflow-hidden rounded-xl border bg-zinc-950/90 ${isHot ? "border-amber-500/40" : "border-zinc-800"}`}>
                  <div className={`border-b px-4 py-3 ${isHot ? "border-amber-500/20" : "border-zinc-800"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">
                        {match.homeTeam} <span className="text-zinc-500">vs</span> {match.awayTeam}
                      </div>
                      {isHot && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                          🔥 Spread
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="w-32 px-4 py-2 text-left text-xs font-normal text-zinc-500">Outcome</th>
                          {bookmakers.map(bm => (
                            <th key={bm} className={`px-3 py-2 text-center text-xs font-normal whitespace-nowrap ${STALE_BOOKS.has(bm) ? "text-amber-700" : "text-zinc-500"}`}>
                              {BOOKMAKER_LABEL[bm] ?? bm}{STALE_BOOKS.has(bm) && " ⚠"}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {outcomes.map(outcome => {
                          const rows = matchOdds.filter(o => o.outcome === outcome);
                          const repLineValue = rows[0]?.lineValue !== undefined ? Number(rows[0].lineValue) : null;
                          const label = outcomeLabel(market, outcome, teamForOutcome[outcome], repLineValue);
                          const best = bestByOutcome[outcome];
                          return (
                            <tr key={outcome} className="border-b border-zinc-800/40 last:border-0">
                              <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {label}
                                  {user && market === "h2h" && (
                                    <PriceAlertButton
                                      matchId={match.id}
                                      matchName={`${match.homeTeam} vs ${match.awayTeam}`}
                                      outcome={outcome}
                                      teamName={teamForOutcome[outcome]}
                                      currentBestPrice={best > 0 ? best : 2}
                                      existingAlertId={alertMap.get(`${match.id}|${outcome}`)?.id}
                                      existingTargetPrice={Number(alertMap.get(`${match.id}|${outcome}`)?.targetPrice)}
                                    />
                                  )}
                                </div>
                              </td>
                              {bookmakers.map(bm => {
                                const odd = rows.find(o => o.bookmaker === bm);
                                const price = odd ? Number(odd.price) : null;
                                const lineValue = odd?.lineValue !== undefined ? Number(odd.lineValue) : null;
                                const isBest = price !== null && price === best;
                                const prev = prevPriceMap.get(`${match.id}|${bm}|${outcome}`);
                                const moved = prev !== undefined && price !== null ? price - prev : null;
                                const drifted  = moved !== null && moved >  0.02;
                                const shortened = moved !== null && moved < -0.02;
                                const flashCls = drifted ? "animate-flash-green" : shortened ? "animate-flash-red" : "";
                                return (
                                  <td key={bm} className={`px-3 py-2.5 text-center ${flashCls}`}>
                                    {price !== null ? (
                                      <a href={`/api/bet?bm=${bm}`} target="_blank" rel="noopener noreferrer"
                                        className="group flex flex-col items-center gap-0 whitespace-nowrap">
                                        <span className={isBest
                                          ? "font-bold text-amber-400 group-hover:text-amber-300 rounded px-0.5 bg-amber-500/10 ring-1 ring-amber-500/40"
                                          : "text-zinc-300 group-hover:text-white"}>
                                          {cellLabel(market, price, lineValue)}
                                        </span>
                                        {moved !== null && Math.abs(moved) > 0.02 && (
                                          <span className={`text-[10px] leading-none font-bold ${drifted ? "text-green-400" : "text-red-400"}`}>
                                            {drifted ? "▲" : "▼"}{Math.abs(moved).toFixed(2)}
                                          </span>
                                        )}
                                      </a>
                                    ) : (
                                      <span className="text-zinc-700">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
