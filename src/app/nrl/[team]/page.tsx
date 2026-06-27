import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";

const NRL_TEAMS: Record<string, string> = {
  "broncos":         "Brisbane Broncos",
  "raiders":         "Canberra Raiders",
  "bulldogs":        "Canterbury Bulldogs",
  "dolphins":        "Dolphins",
  "titans":          "Gold Coast Titans",
  "sea-eagles":      "Manly Sea Eagles",
  "storm":           "Melbourne Storm",
  "knights":         "Newcastle Knights",
  "cowboys":         "North Queensland Cowboys",
  "eels":            "Parramatta Eels",
  "panthers":        "Penrith Panthers",
  "rabbitohs":       "South Sydney Rabbitohs",
  "dragons":         "St George Illawarra Dragons",
  "roosters":        "Sydney Roosters",
  "tigers":          "Wests Tigers",
  "warriors":        "New Zealand Warriors",
  "sharks":          "Cronulla Sharks",
};

const BOOKMAKER_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", ladbrokes: "Ladbrokes", neds: "Neds",
  pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight", betr: "Betr",
  betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp",
};

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const teamName = NRL_TEAMS[team];
  if (!teamName) return { title: "NRL Odds — EdgeBoard" };
  return {
    title: `${teamName} NRL Odds — Best Prices Across 11 Bookmakers | EdgeBoard`,
    description: `Compare the best ${teamName} NRL odds across Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch and PlayUp. Updated every 30 minutes.`,
    openGraph: {
      title: `${teamName} NRL Odds`,
      description: `Live ${teamName} odds across 11 Australian bookmakers, updated in real time.`,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(NRL_TEAMS).map(team => ({ team }));
}

export default async function TeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const teamName = NRL_TEAMS[team];
  if (!teamName) notFound();

  const now = new Date();
  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: { gte: now, lte: new Date(now.getTime() + 14 * 86_400_000) },
      OR: [
        { homeTeam: { contains: teamName.split(" ").slice(-1)[0], mode: "insensitive" } },
        { awayTeam: { contains: teamName.split(" ").slice(-1)[0], mode: "insensitive" } },
      ],
    },
    include: {
      odds: {
        where: { marketType: "h2h", bookmaker: { notIn: ["bet365"] } },
        orderBy: { bookmaker: "asc" },
      },
    },
    orderBy: { kickoffAt: "asc" },
    take: 5,
  });

  const bookmakers = ["sportsbet", "tab", "ladbrokes", "neds", "pointsbet", "unibet", "betright", "betr", "betfair", "tabtouch", "playup"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <Link href="/nrl" className="text-xs text-zinc-500 hover:text-zinc-300 transition">← NRL Odds Board</Link>
        <h1 className="mt-3 text-2xl font-semibold">{teamName} — NRL Odds</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Best {teamName} prices across {Object.keys(BOOKMAKER_LABEL).length} Australian bookmakers, updated every 30 minutes.
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-10 text-center space-y-3">
          <p className="text-zinc-400">No upcoming {teamName} matches in the next 14 days.</p>
          <Link href="/nrl" className="inline-block text-sm text-amber-400 hover:text-amber-300 transition">
            View full NRL schedule →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map(match => {
            type OddsRow = { bookmaker: string; outcome: string | null; price: unknown };
            const odds = match.odds as unknown as OddsRow[];
            const homeOdds = odds.filter(o => o.outcome === "home");
            const awayOdds = odds.filter(o => o.outcome === "away");
            const bestHome = homeOdds.length ? Math.max(...homeOdds.map(o => Number(o.price))) : null;
            const bestAway = awayOdds.length ? Math.max(...awayOdds.map(o => Number(o.price))) : null;
            const kickoff  = match.kickoffAt.toLocaleString("en-AU", {
              timeZone: "Australia/Sydney", weekday: "long", day: "numeric", month: "long",
              hour: "numeric", minute: "2-digit", hour12: true,
            });

            const isTeamHome = match.homeTeam.toLowerCase().includes(teamName.split(" ").slice(-1)[0].toLowerCase());
            const teamOutcome = isTeamHome ? "home" : "away";
            const bestTeamPrice = teamOutcome === "home" ? bestHome : bestAway;
            const bestTeamBook = odds.find(o => o.outcome === teamOutcome && Number(o.price) === bestTeamPrice);

            return (
              <div key={match.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <div className="font-medium">{match.homeTeam} vs {match.awayTeam}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{kickoff} AEST</div>
                </div>

                {/* Best price callout */}
                {bestTeamPrice && bestTeamBook && (
                  <div className="flex items-center gap-4 border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
                    <div>
                      <div className="text-xs text-zinc-500">Best {teamName.split(" ").slice(-1)[0]} price</div>
                      <div className="text-3xl font-bold text-amber-400">${bestTeamPrice.toFixed(2)}</div>
                      <div className="text-xs text-zinc-500">{BOOKMAKER_LABEL[bestTeamBook.bookmaker as string]}</div>
                    </div>
                    <div className="ml-auto">
                      <a href={`/api/bet?bm=${bestTeamBook.bookmaker}`} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition">
                        Bet at {BOOKMAKER_LABEL[bestTeamBook.bookmaker as string]} →
                      </a>
                    </div>
                  </div>
                )}

                {/* Price comparison table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-2 text-left text-xs font-normal text-zinc-500">Bookmaker</th>
                        <th className="px-3 py-2 text-center text-xs font-normal text-zinc-500">{match.homeTeam.split(" ").slice(-1)[0]}</th>
                        <th className="px-3 py-2 text-center text-xs font-normal text-zinc-500">{match.awayTeam.split(" ").slice(-1)[0]}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookmakers.map(bm => {
                        const hRow = homeOdds.find(o => o.bookmaker === bm);
                        const aRow = awayOdds.find(o => o.bookmaker === bm);
                        if (!hRow && !aRow) return null;
                        const hp = hRow ? Number(hRow.price) : null;
                        const ap = aRow ? Number(aRow.price) : null;
                        return (
                          <tr key={bm} className="border-b border-zinc-800/40 last:border-0">
                            <td className="px-4 py-2.5 text-xs text-zinc-400">
                              <a href={`/api/bet?bm=${bm}`} target="_blank" rel="noopener noreferrer"
                                className="hover:text-zinc-200 transition">
                                {BOOKMAKER_LABEL[bm]}
                              </a>
                            </td>
                            <td className={`px-3 py-2.5 text-center text-xs tabular-nums ${hp === bestHome ? "font-semibold text-amber-400" : "text-zinc-400"}`}>
                              {hp !== null ? `$${hp.toFixed(2)}` : "—"}
                            </td>
                            <td className={`px-3 py-2.5 text-center text-xs tabular-nums ${ap === bestAway ? "font-semibold text-amber-400" : "text-zinc-400"}`}>
                              {ap !== null ? `$${ap.toFixed(2)}` : "—"}
                            </td>
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

      <div className="space-y-3">
        <Link href={`/nrl?team=${encodeURIComponent(teamName.split(" ").slice(-1)[0])}`}
          className="inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition">
          View all {teamName} odds on the full board →
        </Link>
        <p className="text-[11px] text-zinc-700">
          EdgeBoard earns a commission when you sign up or deposit at a bookmaker via our links. Odds are fetched directly from each bookmaker.{" "}
          <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener noreferrer" className="underline">Gambling Help Online 1800 858 858</a>.
        </p>
      </div>
    </div>
  );
}
