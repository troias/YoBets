import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";
import { PaywallGate } from "@/components/paywall-gate";
import { ArbPushNudge } from "@/components/arb-push-nudge";
import { getSubscriptionStatus, isProOrAdmin } from "@/lib/subscription";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.com.au";

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

type NearMiss = {
  key: string;
  matchName: string;
  kickoffAt: Date;
  gapPct: number;
  legs: Array<{ bookmaker: string; outcome: string; odds: number; deepLinkUrl: string }>;
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

  // Bookmaker balances from cookie — used to scale arb stake suggestions
  const balancesCookieRaw = (await cookieStore).get("bm_balances")?.value ?? "";
  let bmBalances: Record<string, number> = {};
  try { bmBalances = balancesCookieRaw ? JSON.parse(decodeURIComponent(balancesCookieRaw)) : {}; }
  catch { /* ignore */ }

  const subStatus = user ? await getSubscriptionStatus(user.id) : null;
  const subscribed = isProOrAdmin(subStatus, user?.email);

  const now = new Date();

  // FOMO: count significant price moves since last visit
  const lastVisitRaw = cookieStore.get("last_visit")?.value;
  const lastVisit = lastVisitRaw ? new Date(lastVisitRaw) : null;
  const lastVisitValid = lastVisit && !isNaN(lastVisit.getTime()) &&
    lastVisit < now && (now.getTime() - lastVisit.getTime()) < 24 * 3_600_000;
  const movesSinceVisit = lastVisitValid
    ? await prisma.oddsSnapshot.count({
        where: { recordedAt: { gt: lastVisit! }, marketType: "h2h", bookmaker: { notIn: ["bet365"] } },
      })
    : 0;

  const { gte, lte } = aestDateRange(date, now);

  const [matches, lastArbsConfig, lastArbAlert] = await Promise.all([
    prisma.match.findMany({
      where: { kickoffAt: { gte, lte } },
      include: { odds: { where: { marketType: market, bookmaker: { notIn: ["bet365"] } } } },
      orderBy: { kickoffAt: "asc" },
    }),
    prisma.appConfig.findUnique({ where: { key: "last_arbs" } }).catch(() => null),
    prisma.alertLog.findFirst({
      where: { alertType: "arb" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }).catch(() => null),
  ]);

  const lastArbHoursAgo = lastArbAlert
    ? Math.round((now.getTime() - lastArbAlert.sentAt.getTime()) / 3_600_000)
    : null;

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

  // Missed arbs: arbs from last poll cycle that are no longer present
  type MissedArb = { matchId: string; matchName: string; kickoffAt: string; roiPercent: number; bookmakers: string[]; savedAt: string };
  let missedArbs: MissedArb[] = [];
  if (market === "h2h" && lastArbsConfig?.value) {
    try {
      const { arbs: prevArbs, savedAt } = JSON.parse(lastArbsConfig.value) as { arbs: MissedArb[]; savedAt: string };
      const currentMatchIds = new Set(arbs.map(a => a.key.replace("-h2h", "")));
      missedArbs = prevArbs
        .filter(a => !currentMatchIds.has(a.matchId))
        .map(a => ({ ...a, savedAt }));
    } catch { /* ignore parse errors */ }
  }

  // Near-misses: h2h matches where combined implied prob is 100–103% (within 3% of being an arb)
  const nearMisses: NearMiss[] = [];
  if (market === "h2h") {
    for (const match of matches) {
      const homeOdds = match.odds.filter(o => o.outcome === "home");
      const awayOdds = match.odds.filter(o => o.outcome === "away");
      if (!homeOdds.length || !awayOdds.length) continue;
      const bestHome = homeOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const bestAway = awayOdds.reduce((b, o) => (Number(o.price) > Number(b.price) ? o : b));
      const implied = 1 / Number(bestHome.price) + 1 / Number(bestAway.price);
      if (implied <= 1.0 || implied > 1.03) continue;
      if (arbs.some(a => a.key === `${match.id}-h2h`)) continue;
      nearMisses.push({
        key: `${match.id}-near`,
        matchName: `${match.homeTeam} vs ${match.awayTeam}`,
        kickoffAt: match.kickoffAt,
        gapPct: (implied - 1) * 100,
        legs: [
          { bookmaker: bestHome.bookmaker, outcome: match.homeTeam, odds: Number(bestHome.price), deepLinkUrl: bestHome.deepLinkUrl },
          { bookmaker: bestAway.bookmaker, outcome: match.awayTeam, odds: Number(bestAway.price), deepLinkUrl: bestAway.deepLinkUrl },
        ],
      });
    }
    nearMisses.sort((a, b) => a.gapPct - b.gapPct);
  }

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

        {!subscribed && lastVisitValid && movesSinceVisit > 10 && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <p className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">{movesSinceVisit} price updates</span> happened since your last visit.
              Pro users were notified in real time.
            </p>
            <Link href="/pricing" className="shrink-0 ml-4 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
              Get alerts →
            </Link>
          </div>
        )}

        {filtered.length > 0 && <ArbPushNudge />}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">No live arbs right now</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Arbs appear when bookmakers disagree enough that you can cover both sides for a guaranteed profit. Most open for under 10 minutes before the books adjust.
              {lastArbHoursAgo !== null && lastArbHoursAgo < 72 && (
                <span className="block mt-1 text-zinc-600">
                  Last arb was found {lastArbHoursAgo === 0 ? "less than an hour" : `${lastArbHoursAgo}h`} ago. Check back closer to kickoff.
                </span>
              )}
            </p>
            {!subscribed && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-4 max-w-sm mx-auto">
                <p className="text-xs font-medium text-amber-300">Don&apos;t miss the next one</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Pro sends a push notification to your phone the instant an arb opens. By the time you check manually, it&apos;s usually gone.
                </p>
                <Link href="/pricing" className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition">
                  Start free trial →
                </Link>
              </div>
            )}
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
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                        <span>{kickoff} AEST</span>
                        <span className="text-zinc-700">·</span>
                        <KickoffCountdown kickoffAt={arb.kickoffAt.toISOString()} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Found a +${arb.roiPercent.toFixed(2)}% guaranteed NRL arb on EdgeBoard — bet both sides and profit regardless of the result`)}&url=${encodeURIComponent(`${SITE_URL}/arbitrage`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-700 hover:text-zinc-400 transition"
                        title="Share on X"
                      >
                        Share 𝕏
                      </a>
                      {(() => {
                      // Scale stakes based on bookmaker balances
                      const leg0bal = bmBalances[arb.legs[0]?.bookmaker];
                      const leg1bal = bmBalances[arb.legs[1]?.bookmaker];
                      const hasBalances = leg0bal != null || leg1bal != null;
                      let scaledTotal = 100;
                      let limitingBook: string | null = null;
                      if (hasBalances) {
                        arb.legs.forEach((leg, i) => {
                          const bal = bmBalances[leg.bookmaker];
                          if (bal == null) return;
                          const share = leg.stake / 100;
                          const maxForThis = bal / share;
                          if (maxForThis < scaledTotal) { scaledTotal = maxForThis; limitingBook = leg.bookmaker; }
                        });
                      }
                      const scaleFactor = scaledTotal / 100;
                      return (
                        <>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-sm font-bold text-amber-400">
                              +{arb.roiPercent.toFixed(2)}%
                            </span>
                            <span className="text-xs text-zinc-500">
                              ${(arb.guaranteedReturn * scaleFactor).toFixed(2)} return on ${scaledTotal.toFixed(0)}
                              {limitingBook && <span className="text-zinc-700"> · capped by {BOOKMAKER_LABEL[limitingBook]}</span>}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {arb.legs.map((leg) => {
                      // Recompute scaled stake
                      let scaledTotal = 100;
                      arb.legs.forEach(l => {
                        const bal = bmBalances[l.bookmaker];
                        if (bal == null) return;
                        const share = l.stake / 100;
                        const maxForThis = bal / share;
                        if (maxForThis < scaledTotal) scaledTotal = maxForThis;
                      });
                      const scaledStake = leg.stake * (scaledTotal / 100);
                      const hasBalance = Object.keys(bmBalances).length > 0;
                      return (
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
                              <div className="text-xs text-zinc-500">
                                Stake ${scaledStake.toFixed(2)}
                                {hasBalance && scaledStake !== leg.stake && <span className="text-zinc-700"> (${leg.stake.toFixed(2)} per $100)</span>}
                              </div>
                            </div>
                            <a
                              href={`/api/bet?bm=${leg.bookmaker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
                            >
                              Bet →
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* You missed it — arbs from last poll that are now gone */}
        {missedArbs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-zinc-400">You missed it</h2>
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 tracking-wide">GONE</span>
            </div>
            <p className="text-xs text-zinc-600">
              These arbs existed last poll but the window has closed. Refresh frequently — they can return.
            </p>
            {missedArbs.map((m) => {
              const savedAt = new Date(m.savedAt).toLocaleTimeString("en-AU", {
                timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true,
              });
              const kickoff = new Date(m.kickoffAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
              });
              return (
                <div key={m.matchId} className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 opacity-75">
                  <div className="flex items-center justify-between border-b border-red-500/15 px-4 py-3">
                    <div>
                      <div className="font-medium text-zinc-300">{m.matchName}</div>
                      <div className="mt-0.5 text-xs text-zinc-600">{kickoff} AEST · was live at {savedAt}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-bold text-red-400 line-through">
                        +{m.roiPercent.toFixed(2)}%
                      </span>
                      <span className="text-xs text-zinc-600">window closed</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 text-xs text-zinc-600">
                    Was on {m.bookmakers.map(b => BOOKMAKER_LABEL[b] ?? b).join(" + ")} · odds moved
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Near Misses — matches within 3% of becoming a live arb */}
        {nearMisses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-zinc-400">Almost there</h2>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 tracking-wide">NEAR MISS</span>
            </div>
            <p className="text-xs text-zinc-600">These could flip to a live arb — the gap is &lt;3%. Refresh to check.</p>
            {nearMisses.map((nm) => {
              const kickoff = nm.kickoffAt.toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
              return (
                <div key={nm.key} className="overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center justify-between border-b border-amber-500/15 px-4 py-3">
                    <div>
                      <div className="font-medium text-zinc-200">{nm.matchName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-bold text-amber-400">
                        {nm.gapPct.toFixed(2)}% from arb
                      </span>
                      <span className="text-xs text-zinc-600">one book needs to move</span>
                    </div>
                  </div>
                  <div className="divide-y divide-amber-500/10">
                    {nm.legs.map((leg) => (
                      <div key={leg.bookmaker + leg.outcome} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs text-zinc-500">
                            {BOOKMAKER_LABEL[leg.bookmaker] ?? leg.bookmaker}
                          </span>
                          <span className="text-sm text-zinc-300">{leg.outcome}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-medium text-zinc-100">@ {leg.odds.toFixed(2)}</div>
                          <a
                            href={`/api/bet?bm=${leg.bookmaker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 transition hover:bg-amber-500/20"
                          >
                            Watch →
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
