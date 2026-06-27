import { cookies } from "next/headers";
import { headers } from "next/headers";
import { userAgent } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { MarketTabs, type MarketType } from "@/components/ui/market-tabs";
import { PaywallGate } from "@/components/paywall-gate";
import { BankrollInput } from "@/components/bankroll-input";
import { getSubscriptionStatus, isProOrAdmin } from "@/lib/subscription";
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
  kellyPct: number;
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
        // Quarter Kelly: f = (p*b - q) / b * 0.25, where b = odds - 1
        const b = Number(o.price) - 1;
        const kellyPct = b > 0 ? Math.max(0, (fairProbA * b - (1 - fairProbA)) / b) * 25 : 0;
        rows.push({
          key: `${matchId}-${o.bookmaker}-${sideA}-${lineKey}`,
          matchName,
          kickoffAt,
          bookmaker: o.bookmaker,
          outcome: outcomeLabel(sideA, o.lineValue),
          offeredOdds: Number(o.price),
          fairOdds: fairOddsA,
          evPercent: ev,
          kellyPct,
          deepLinkUrl: o.deepLinkUrl,
        });
      }
    }

    for (const o of bOdds) {
      const ev = (Number(o.price) * fairProbB - 1) * 100;
      if (ev >= minEv) {
        const b = Number(o.price) - 1;
        const kellyPct = b > 0 ? Math.max(0, (fairProbB * b - (1 - fairProbB)) / b) * 25 : 0;
        rows.push({
          key: `${matchId}-${o.bookmaker}-${sideB}-${lineKey}`,
          matchName,
          kickoffAt,
          bookmaker: o.bookmaker,
          outcome: outcomeLabel(sideB, o.lineValue),
          offeredOdds: Number(o.price),
          fairOdds: fairOddsB,
          evPercent: ev,
          kellyPct,
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
  const headersList = await headers();
  const { device } = userAgent({ headers: headersList });
  const isMobile = device.type === "mobile" || device.type === "tablet";

  const market = (
    ["h2h", "line", "total"].includes(params.market ?? "") ? params.market : "h2h"
  ) as MarketType;
  const minEv = Math.max(0, Number(params.minEv ?? 0));
  const date  = ["today", "tomorrow", "all"].includes(params.date ?? "") ? (params.date ?? "all") : "all";

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const subStatus = user ? await getSubscriptionStatus(user.id) : null;
  const subscribed = isProOrAdmin(subStatus, user?.email);

  const bankroll = Math.max(0, Number(cookieStore.get("bankroll")?.value ?? 0));

  const now = new Date();

  // FOMO: count price moves since last visit
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

  const matches = await prisma.match.findMany({
    where: { kickoffAt: { gte, lte } },
    include: { odds: { where: { marketType: market, bookmaker: { notIn: ["bet365"] } } } },
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

  // For empty-state context: total positive-EV bets at threshold=0, and last alert_log entry
  const allPositiveCount = evRows.length === 0 && minEv > 0
    ? matches.reduce((total, match) => {
        const matchEvRows = computeEV(match.id, `${match.homeTeam} vs ${match.awayTeam}`, match.kickoffAt, match.homeTeam, match.awayTeam, market, match.odds, 0);
        return total + matchEvRows.length;
      }, 0)
    : 0;

  const lastEvAlert = evRows.length === 0
    ? await prisma.alertLog.findFirst({
        where: { alertType: "ev" },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true, key: true },
      }).catch(() => null)
    : null;

  const lastEvHoursAgo = lastEvAlert
    ? Math.round((now.getTime() - lastEvAlert.sentAt.getTime()) / 3_600_000)
    : null;

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
          <BankrollInput initialValue={bankroll} />
        </div>

        {!subscribed && lastVisitValid && movesSinceVisit > 10 && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <p className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">{movesSinceVisit} price updates</span> happened since your last visit — some of those EV windows are already gone.
            </p>
            <Link href="/pricing" className="shrink-0 ml-4 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
              Get alerts →
            </Link>
          </div>
        )}

        {/* Kelly explainer */}
        <details className="group rounded-xl border border-zinc-800 bg-zinc-950/90">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs text-zinc-500 hover:text-zinc-300 list-none">
            <span>What is ¼ Kelly and how much should I stake?</span>
            <span className="group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="border-t border-zinc-800 px-4 py-4 space-y-3 text-xs text-zinc-400 leading-relaxed">
            <p>
              <span className="font-semibold text-zinc-200">Kelly Criterion</span> is a formula that tells you the mathematically optimal fraction of your bankroll to wager on a +EV bet. The full Kelly bet is aggressive and causes wild swings, so sharp bettors use{" "}
              <span className="font-semibold text-zinc-200">Quarter Kelly (¼ Kelly)</span> — exactly 25% of the Kelly recommendation. It still grows your bankroll efficiently while protecting against bad runs.
            </p>
            <div className="rounded-lg bg-zinc-900 px-3 py-3 space-y-1.5">
              <p className="text-zinc-300 font-medium">Formula</p>
              <p className="font-mono text-zinc-400">Kelly % = (fair_prob × (odds − 1) − (1 − fair_prob)) ÷ (odds − 1)</p>
              <p className="font-mono text-zinc-400">¼ Kelly stake = bankroll × (Kelly % × 0.25)</p>
            </div>
            <div className="rounded-lg bg-zinc-900 px-3 py-3 space-y-1.5">
              <p className="text-zinc-300 font-medium">Example</p>
              <p>Odds: 2.10 · Fair probability: 52% · Bankroll: $1,000</p>
              <p>Kelly % = (0.52 × 1.10 − 0.48) ÷ 1.10 ≈ <span className="text-white font-semibold">4.0%</span></p>
              <p>¼ Kelly stake = $1,000 × (4.0% × 0.25) = <span className="text-amber-400 font-semibold">$10.00</span></p>
            </div>
            <p className="text-zinc-600">
              Rule of thumb: never stake more than 2–5% of your bankroll on a single bet, no matter what the formula says. The dots below show bet strength — 5 dots = near the 2% cap.
              {bankroll > 0
                ? ` Your bankroll is set to $${bankroll.toLocaleString()} — dollar amounts are shown in the ¼ Kelly column.`
                : " Enter your bankroll in the filter bar above to see recommended dollar amounts."}
            </p>
          </div>
        </details>

        <p className="text-xs text-zinc-600">
          Boosted/promo prices and Bet365 (stale scraped data) are excluded from the fair odds model.
        </p>

        {evRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-300">
              No bets above +{minEv}% EV right now
            </p>
            {allPositiveCount > 0 ? (
              <p className="text-xs text-zinc-500">
                {allPositiveCount} positive-EV bet{allPositiveCount !== 1 ? "s" : ""} exist below your {minEv}% threshold —{" "}
                <a href={`?market=${market}&date=${date}&minEv=0`} className="text-amber-500 hover:text-amber-400 transition">remove the filter</a> to see them.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                +EV bets typically surface in the 1–3h window before kickoff when books start shading one side. Check back as matches approach.
                {lastEvHoursAgo !== null && lastEvHoursAgo < 48 && (
                  <span className="block mt-1 text-zinc-600">Last +EV bet was found {lastEvHoursAgo === 0 ? "less than an hour" : `${lastEvHoursAgo}h`} ago.</span>
                )}
              </p>
            )}
          </div>
        ) : isMobile ? (
          /* ── Mobile: card per row ──────────────────────────────────────── */
          <div className="space-y-3">
            {evRows.map((row) => {
              const kickoff = row.kickoffAt.toLocaleString("en-AU", {
                timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short",
              });
              const evColor = row.evPercent >= 5 ? "text-amber-400" : row.evPercent >= 2 ? "text-green-400" : "text-emerald-600";
              const dots = Math.min(5, Math.round(row.kellyPct / 4));
              return (
                <div key={row.key} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
                  {/* Header */}
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="text-sm font-medium text-zinc-200">{row.matchName}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{kickoff} · {BOOKMAKER_LABEL[row.bookmaker] ?? row.bookmaker}</div>
                  </div>
                  {/* Body */}
                  <div className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-100">{row.outcome}</div>
                      <div className="mt-1 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <span key={j} className={`h-1.5 w-1.5 rounded-full ${j < dots ? "bg-green-500" : "bg-zinc-800"}`} />
                        ))}
                        <span className="ml-1 text-[10px] text-zinc-600">
                          {bankroll > 0 ? `$${(bankroll * row.kellyPct / 100).toFixed(2)} ¼K` : `${row.kellyPct.toFixed(1)}% ¼K`}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="text-2xl font-bold text-white tabular-nums">{row.offeredOdds.toFixed(2)}</div>
                      <div className="text-[10px] text-zinc-600">fair {row.fairOdds.toFixed(2)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-xl font-bold tabular-nums ${evColor}`}>+{row.evPercent.toFixed(1)}%</div>
                      <div className="text-[10px] text-zinc-600">EV</div>
                    </div>
                  </div>
                  {/* Action */}
                  <div className="border-t border-zinc-800/60 bg-zinc-950 px-4 py-2.5 flex items-center justify-between">
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`+${row.evPercent.toFixed(1)}% EV on ${row.outcome} at ${BOOKMAKER_LABEL[row.bookmaker] ?? row.bookmaker} — found via EdgeBoard NRL odds tool`)}&url=${encodeURIComponent(`${SITE_URL}/ev`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-zinc-700 hover:text-zinc-400 transition">
                      Share on 𝕏
                    </a>
                    <a href={`/api/bet?bm=${row.bookmaker}`} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition active:bg-amber-500/20">
                      Bet at {BOOKMAKER_LABEL[row.bookmaker] ?? row.bookmaker} →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop: table ────────────────────────────────────────────── */
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Match</th>
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Outcome</th>
                  <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Book</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Price vs Fair</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">EV</th>
                  <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">
                    ¼ Kelly{bankroll > 0 ? ` (of $${bankroll.toLocaleString()})` : ""}
                  </th>
                  <th className="px-4 py-2.5 text-xs font-normal text-zinc-500 sr-only">Bet</th>
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-white">{row.offeredOdds.toFixed(2)}</span>
                          <span className="text-[10px] text-zinc-600">fair: {row.fairOdds.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.evPercent >= 5
                              ? "text-amber-400"
                              : row.evPercent >= 2
                              ? "text-green-400"
                              : "text-emerald-600"
                          }`}
                        >
                          +{row.evPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => {
                              const filled = j < Math.min(5, Math.round(row.kellyPct / 4));
                              return (
                                <span key={j} className={`h-1.5 w-1.5 rounded-full ${filled ? "bg-green-500" : "bg-zinc-800"}`} />
                              );
                            })}
                          </div>
                          {bankroll > 0 ? (
                            <span className="text-xs font-semibold text-amber-400">
                              ${(bankroll * row.kellyPct / 100).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600">{row.kellyPct.toFixed(1)}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`+${row.evPercent.toFixed(1)}% EV on ${row.outcome} at ${BOOKMAKER_LABEL[row.bookmaker] ?? row.bookmaker} — found via EdgeBoard NRL odds tool`)}&url=${encodeURIComponent(`${SITE_URL}/ev`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-700 hover:text-zinc-400 transition"
                            title="Share on X"
                          >
                            𝕏
                          </a>
                          <a
                            href={`/api/bet?bm=${row.bookmaker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 hover:text-amber-300"
                          >
                            Bet →
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {!subscribed && evRows.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/90 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">These prices won&apos;t last</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                +EV windows close when other punters or books adjust. Pro sends a push notification the moment a new one appears.
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 ml-4"
            >
              Get alerts →
            </Link>
          </div>
        )}
      </div>
      </PaywallGate>
    </AppShell>
  );
}
