import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PaywallGate } from "@/components/paywall-gate";

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", bet365: "Bet365", ladbrokes: "Ladbrokes",
  neds: "Neds", pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight",
  betr: "Betr", betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

export default async function LivePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  // Include matches explicitly marked live OR kicked off in the last 3 hours (worker may not have updated status yet)
  const threeHoursAgo = new Date(now.getTime() - 3 * 3_600_000);
  const twoHoursAhead = new Date(now.getTime() + 2 * 3_600_000);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { status: "live" },
        { kickoffAt: { gte: threeHoursAgo, lte: twoHoursAhead } },
      ],
    },
    include: {
      odds: { where: { marketType: "h2h" }, orderBy: { bookmaker: "asc" } },
      snapshots: {
        where: { marketType: "h2h", recordedAt: { gte: new Date(now.getTime() - 3_600_000) } },
        orderBy: { recordedAt: "desc" },
        take: 50,
      },
    },
    orderBy: { kickoffAt: "asc" },
  });

  const checkedAt = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <AppShell activePath="/live" userEmail={user?.email}>
      <PaywallGate userId={user?.id ?? ""} userEmail={user?.email}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Live Markets</h1>
              <p className="text-sm text-zinc-400">In-play and kicking off within 2 hours · Checked {checkedAt} AEST</p>
            </div>
            {matches.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-xs text-green-400">{matches.length} match{matches.length !== 1 ? "es" : ""}</span>
              </div>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-12 text-center">
              <p className="text-sm font-medium text-zinc-300">No live or imminent matches</p>
              <p className="mt-1 text-xs text-zinc-500">
                This page shows matches in-play or kicking off within the next 2 hours.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const bookmakers = [...new Set(match.odds.map(o => o.bookmaker))];
                const outcomes = ["home", "away"] as const;
                const bestByOutcome: Record<string, number> = {};
                for (const oc of outcomes) {
                  const rows = match.odds.filter(o => o.outcome === oc);
                  bestByOutcome[oc] = rows.length ? Math.max(...rows.map(o => Number(o.price))) : 0;
                }

                // Detect recent moves from snapshots for this match
                const movesByKey = new Map<string, { from: number; to: number; pct: number }>();
                for (const oc of outcomes) {
                  for (const bm of bookmakers) {
                    const snaps = match.snapshots
                      .filter(s => s.outcome === oc && s.bookmaker === bm)
                      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
                    if (snaps.length < 2) continue;
                    const from = Number(snaps[0].price);
                    const to = Number(snaps[snaps.length - 1].price);
                    const pct = ((to - from) / from) * 100;
                    if (Math.abs(pct) >= 2) movesByKey.set(`${bm}|${oc}`, { from, to, pct });
                  }
                }

                const isLive = match.status === "live" || match.kickoffAt <= now;
                const kickoff = match.kickoffAt.toLocaleString("en-AU", {
                  timeZone: "Australia/Sydney", weekday: "short", day: "numeric",
                  month: "short", hour: "numeric", minute: "2-digit", hour12: true,
                });

                return (
                  <div key={match.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                      <div>
                        <div className="font-medium">
                          {match.homeTeam} <span className="text-zinc-500">vs</span> {match.awayTeam}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                      </div>
                      {isLive && (
                        <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-400">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                          Live
                        </div>
                      )}
                    </div>

                    {bookmakers.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-zinc-600">No odds available yet</p>
                    ) : (
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
                            {outcomes.map(oc => {
                              const rows = match.odds.filter(o => o.outcome === oc);
                              const label = oc === "home" ? match.homeTeam.split(" ").slice(-1)[0] : match.awayTeam.split(" ").slice(-1)[0];
                              const best = bestByOutcome[oc];
                              return (
                                <tr key={oc} className="border-b border-zinc-800/40 last:border-0">
                                  <td className="px-4 py-2.5 text-xs text-zinc-400">{label}</td>
                                  {bookmakers.map(bm => {
                                    const odd = rows.find(o => o.bookmaker === bm);
                                    const price = odd ? Number(odd.price) : null;
                                    const isBest = price !== null && price === best;
                                    const move = movesByKey.get(`${bm}|${oc}`);
                                    return (
                                      <td key={bm} className="px-3 py-2.5 text-center">
                                        {price !== null ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <a href={odd!.deepLinkUrl} target="_blank" rel="noopener noreferrer"
                                              className={isBest ? "font-semibold text-green-400 hover:text-green-300" : "text-zinc-300 hover:text-zinc-100"}>
                                              {price.toFixed(2)}
                                            </a>
                                            {move && (
                                              <span className={`text-[10px] ${move.pct < 0 ? "text-red-400" : "text-amber-400"}`}>
                                                {move.pct > 0 ? "▲" : "▼"}{Math.abs(move.pct).toFixed(1)}%
                                              </span>
                                            )}
                                          </div>
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
                    )}
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
