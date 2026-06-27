import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { PaywallGate } from "@/components/paywall-gate";

type OddsRow = { bookmaker: string; marketType: string; outcome: string | null; price: number | string; deepLinkUrl?: string; lineValue?: number | string | null };
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

const ALL_BOOKMAKERS = Object.keys(BOOKMAKER_LABEL);

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

  // Bookmaker filter: parse from param, fall back to all
  const booksParam   = params.books?.split(",").filter(b => ALL_BOOKMAKERS.includes(b)) ?? [];
  const activeBooks  = booksParam.length > 0 ? booksParam : ALL_BOOKMAKERS;
  const allSelected  = activeBooks.length === ALL_BOOKMAKERS.length;

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

  // Bookmaker toggle: clicking a bookmaker adds/removes from activeBooks
  function toggleBook(bm: string) {
    const isActive = activeBooks.includes(bm);
    let newBooks: string[];
    if (isActive) {
      newBooks = activeBooks.filter(b => b !== bm);
      if (newBooks.length === 0) newBooks = ALL_BOOKMAKERS; // prevent empty
    } else {
      newBooks = [...activeBooks, bm];
    }
    const allNow = newBooks.length === ALL_BOOKMAKERS.length;
    return u({ books: allNow ? "" : newBooks.join(",") });
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
            <p className="text-sm text-zinc-400">12 bookmakers · next 7 days</p>
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
            {!allSelected && <input type="hidden" name="books" value={activeBooks.join(",")} />}
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs text-zinc-500">Books</span>
          <a href={u({ books: "" })}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${allSelected ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
            All
          </a>
          {ALL_BOOKMAKERS.map(bm => {
            const active = activeBooks.includes(bm);
            return (
              <a key={bm} href={toggleBook(bm)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${active && !allSelected ? "bg-zinc-700 text-zinc-100" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {BOOKMAKER_LABEL[bm]}
              </a>
            );
          })}
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
                const rows = matchOdds.filter(o => o.outcome === outcome);
                bestByOutcome[outcome] = rows.length ? Math.max(...rows.map(o => Number(o.price))) : 0;
              }
              const kickoff = match.kickoffAt.toLocaleString("en-AU", {
                timeZone: "Australia/Sydney", weekday: "short", day: "numeric",
                month: "short", hour: "numeric", minute: "2-digit", hour12: true,
              });
              if (!bookmakers.length) return null;
              return (
                <div key={match.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="font-medium">
                      {match.homeTeam} <span className="text-zinc-500">vs</span> {match.awayTeam}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="w-32 px-4 py-2 text-left text-xs font-normal text-zinc-500">Outcome</th>
                          {bookmakers.map(bm => (
                            <th key={bm} className="px-3 py-2 text-center text-xs font-normal text-zinc-500 whitespace-nowrap">
                              {BOOKMAKER_LABEL[bm] ?? bm}
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
                              <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{label}</td>
                              {bookmakers.map(bm => {
                                const odd = rows.find(o => o.bookmaker === bm);
                                const price = odd ? Number(odd.price) : null;
                                const lineValue = odd?.lineValue !== undefined ? Number(odd.lineValue) : null;
                                const isBest = price !== null && price === best;
                                return (
                                  <td key={bm} className="px-3 py-2.5 text-center">
                                    {price !== null ? (
                                      <a href={odd!.deepLinkUrl} target="_blank" rel="noopener noreferrer"
                                        className={isBest
                                          ? "font-semibold text-green-400 hover:text-green-300 whitespace-nowrap"
                                          : "text-zinc-300 hover:text-zinc-100 whitespace-nowrap"}>
                                        {cellLabel(market, price, lineValue)}
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
