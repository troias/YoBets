import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PaywallGate } from "@/components/paywall-gate";

type OddsRow = { bookmaker: string; outcome: string | null; price: number | string; deepLinkUrl?: string; updatedAt: Date };
type SnapRow = { bookmaker: string; outcome: string | null; price: number | string; recordedAt: Date };
type MatchRow = { id: string; homeTeam: string; awayTeam: string; kickoffAt: Date; odds: OddsRow[]; snapshots: SnapRow[] };

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", bet365: "Bet365", ladbrokes: "Ladbrokes",
  neds: "Neds", pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight",
  betr: "Betr", betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// No-vig EV: uses the best available price on each side as the sharpest estimate of true probability.
// EV = offeredPrice × fairProb − 1
function noVigEV(offerPrice: number, allSameOdds: number[], allOppOdds: number[]): number {
  const bestSame = Math.max(...allSameOdds);
  const bestOpp  = Math.max(...allOppOdds);
  const impl = 1 / bestSame;
  const vig  = impl + 1 / bestOpp;
  const fairProb = impl / vig;
  return offerPrice * fairProb - 1;
}

export default async function BriefPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
  // "Yesterday" window: snapshots recorded 20–28h ago
  const snapStart = new Date(now.getTime() - 28 * 3_600_000);
  const snapEnd   = new Date(now.getTime() - 20 * 3_600_000);

  const matches = (await prisma.match.findMany({
    where: { kickoffAt: { gte: now, lte: sevenDaysOut }, status: "upcoming" },
    include: {
      odds: { where: { marketType: "h2h", bookmaker: { notIn: ["bet365"] } } },
      snapshots: {
        where: { marketType: "h2h", recordedAt: { gte: snapStart, lte: snapEnd }, bookmaker: { notIn: ["bet365"] } },
        orderBy: { recordedAt: "asc" },
      },
    },
    orderBy: { kickoffAt: "asc" },
  })) as unknown as MatchRow[];

  // ─── Signals ─────────────────────────────────────────────────────────────────

  type EVEntry = {
    matchName: string; homeTeam: string; awayTeam: string;
    outcome: string; label: string;
    bookmaker: string; price: number; ev: number;
    deepLinkUrl?: string; kickoffAt: Date;
  };
  type MispricedEntry = {
    matchName: string;
    label: string; bookmaker: string;
    price: number; consensus: number; deviation: number;
    deepLinkUrl?: string; kickoffAt: Date;
  };
  type MoverEntry = {
    matchName: string; label: string; bookmaker: string;
    oldPrice: number; newPrice: number; changePct: number;
    kickoffAt: Date;
  };

  const evBets: EVEntry[] = [];
  const mispricings: MispricedEntry[] = [];
  const movers: MoverEntry[] = [];
  let highEvCount = 0;
  let arbCount = 0;
  let latestUpdate: Date | null = null;

  for (const match of matches) {
    const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
    const homeOdds = match.odds.filter(o => o.outcome === "home");
    const awayOdds = match.odds.filter(o => o.outcome === "away");
    if (!homeOdds.length || !awayOdds.length) continue;

    const homePrices = homeOdds.map(o => Number(o.price));
    const awayPrices = awayOdds.map(o => Number(o.price));
    const homeConsensus = median(homePrices);
    const awayConsensus = median(awayPrices);

    // Latest odds refresh timestamp
    for (const o of match.odds) {
      if (!latestUpdate || o.updatedAt > latestUpdate) latestUpdate = o.updatedAt;
    }

    // Arb check
    const bestHome = Math.max(...homePrices);
    const bestAway = Math.max(...awayPrices);
    if (1 / bestHome + 1 / bestAway < 1.0) arbCount++;

    // Per-bookmaker EV + mispricing
    const sides = [
      { odds: homeOdds, oppOdds: awayOdds, label: match.homeTeam, outcome: "home", consensus: homeConsensus },
      { odds: awayOdds, oppOdds: homeOdds, label: match.awayTeam, outcome: "away", consensus: awayConsensus },
    ];

    for (const { odds, oppOdds, label, outcome, consensus } of sides) {
      const sameAllPrices = odds.map(o => Number(o.price));
      const oppAllPrices  = oppOdds.map(o => Number(o.price));

      for (const o of odds) {
        const price = Number(o.price);

        // EV
        const ev = noVigEV(price, sameAllPrices, oppAllPrices);
        if (ev > 0) {
          evBets.push({ matchName, homeTeam: match.homeTeam, awayTeam: match.awayTeam, outcome, label, bookmaker: o.bookmaker, price, ev, deepLinkUrl: o.deepLinkUrl, kickoffAt: match.kickoffAt });
          if (ev >= 0.05) highEvCount++;
        }

        // Mispricing vs consensus
        const dev = (price / consensus - 1) * 100;
        if (dev >= 4) {
          mispricings.push({ matchName, label, bookmaker: o.bookmaker, price, consensus, deviation: dev, deepLinkUrl: o.deepLinkUrl, kickoffAt: match.kickoffAt });
        }
      }
    }

    // 24h movers — first snapshot per (bookmaker, outcome) in the window = "yesterday" price
    const snapYesterday = new Map<string, number>();
    for (const snap of match.snapshots) {
      const key = `${snap.bookmaker}|${snap.outcome}`;
      if (!snapYesterday.has(key)) snapYesterday.set(key, Number(snap.price));
    }

    for (const o of match.odds) {
      if (o.outcome !== "home" && o.outcome !== "away") continue;
      const key = `${o.bookmaker}|${o.outcome}`;
      const old = snapYesterday.get(key);
      if (!old) continue;
      const current = Number(o.price);
      const changePct = ((current - old) / old) * 100;
      if (Math.abs(changePct) < 3) continue;
      const label = o.outcome === "home" ? match.homeTeam : match.awayTeam;
      movers.push({ matchName, label, bookmaker: o.bookmaker, oldPrice: old, newPrice: current, changePct, kickoffAt: match.kickoffAt });
    }
  }

  evBets.sort((a, b) => b.ev - a.ev);
  mispricings.sort((a, b) => b.deviation - a.deviation);
  movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const topEV        = evBets.slice(0, 5);
  const topMispriced = mispricings.slice(0, 3);
  const topMovers    = movers.slice(0, 6);

  const refreshedAt = latestUpdate
    ? latestUpdate.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  return (
    <AppShell activePath="/brief" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">Market Brief</h1>
              <p className="text-sm text-zinc-400">What to bet · What&apos;s off · What moved</p>
            </div>
            {refreshedAt && (
              <span className="shrink-0 text-xs text-zinc-600 mt-1">Updated {refreshedAt} AEST</span>
            )}
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <Chip label={`${matches.length} matches`} />
            <Chip label={`${highEvCount} bets ≥5% EV`} highlight={highEvCount > 0} color="green" />
            <Chip label={`${arbCount} arb${arbCount !== 1 ? "s" : ""}`} highlight={arbCount > 0} color="green" />
            <Chip label={`${topMovers.length} movers`} highlight={topMovers.length > 0} color="blue" />
          </div>

          {/* Best EV Bets */}
          <Section title="Best Value Bets Right Now" aside={<Link href="/ev" className="text-xs text-zinc-500 hover:text-zinc-300">All EV →</Link>}>
            {topEV.length === 0 ? (
              <Empty>No +EV bets detected. Try refreshing odds from Admin.</Empty>
            ) : topEV.map((b, i) => (
              <Row key={i}
                left={
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-zinc-600 tabular-nums">{i + 1}.</span>
                      <span className="text-sm font-medium text-zinc-100">{b.label}</span>
                      <span className="text-xs text-zinc-500 truncate max-w-48">{b.matchName}</span>
                    </div>
                    <div className="ml-4 mt-0.5 text-xs text-zinc-500">
                      {BOOKMAKER_LABEL[b.bookmaker] ?? b.bookmaker} · ${b.price.toFixed(2)} ·{" "}
                      {b.kickoffAt.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short" })}
                    </div>
                  </div>
                }
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-400">+{(b.ev * 100).toFixed(1)}%</span>
                    {b.deepLinkUrl && <BetLink href={b.deepLinkUrl} color="green" />}
                  </div>
                }
              />
            ))}
          </Section>

          {/* Most Mispriced */}
          <Section
            title="Most Mispriced vs Market Consensus"
            aside={<span className="text-xs text-zinc-600">median across all books</span>}
          >
            {topMispriced.length === 0 ? (
              <Empty>No significant mispricings detected right now.</Empty>
            ) : topMispriced.map((m, i) => (
              <Row key={i}
                left={
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-zinc-100">{m.label}</span>
                      <span className="text-xs text-zinc-500 truncate max-w-48">{m.matchName}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {BOOKMAKER_LABEL[m.bookmaker] ?? m.bookmaker} ${m.price.toFixed(2)} · consensus ${m.consensus.toFixed(2)}
                    </div>
                  </div>
                }
                right={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400">+{m.deviation.toFixed(1)}%</span>
                    {m.deepLinkUrl && <BetLink href={m.deepLinkUrl} color="amber" />}
                  </div>
                }
              />
            ))}
          </Section>

          {/* Biggest Movers */}
          <Section title="Biggest Line Moves (last 24h)" aside={<Link href="/line-movement" className="text-xs text-zinc-500 hover:text-zinc-300">Full history →</Link>}>
            {topMovers.length === 0 ? (
              <Empty>Line movement data appears after 24h of odds collection.</Empty>
            ) : topMovers.map((m, i) => {
              const shortened = m.changePct < 0;
              return (
                <Row key={i}
                  left={
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-zinc-100">{m.label}</span>
                        <span className="text-xs text-zinc-500 truncate max-w-48">{m.matchName}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {BOOKMAKER_LABEL[m.bookmaker] ?? m.bookmaker} · ${m.oldPrice.toFixed(2)} → ${m.newPrice.toFixed(2)}
                        {shortened ? " (shortened — possible sharp money)" : " (drifting — public backing the other side?)"}
                      </div>
                    </div>
                  }
                  right={
                    <span className={`text-sm font-bold ${shortened ? "text-red-400" : "text-blue-400"}`}>
                      {shortened ? "▼" : "▲"}{Math.abs(m.changePct).toFixed(1)}%
                    </span>
                  }
                />
              );
            })}
          </Section>

        </div>
      </PaywallGate>
    </AppShell>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Chip({ label, highlight, color }: { label: string; highlight?: boolean; color?: "green" | "blue" }) {
  const active = highlight && color;
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${
      active === "green" ? "bg-green-900/40 text-green-400" :
      active === "blue"  ? "bg-blue-900/40 text-blue-400" :
      "bg-zinc-900 text-zinc-500"
    }`}>
      {label}
    </span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        {aside}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">{left}</div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-600">{children}</p>;
}

function BetLink({ href, color }: { href: string; color: "green" | "amber" }) {
  const cls = color === "green"
    ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
    : "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`rounded px-2.5 py-1 text-xs transition ${cls}`}>
      Bet →
    </a>
  );
}
