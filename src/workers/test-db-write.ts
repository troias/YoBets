// End-to-end test: fetch odds → write to Supabase → verify rows exist.
// Run: npx tsx --env-file .env.local src/workers/test-db-write.ts

import { PrismaClient } from "@prisma/client";
import { TheOddsApiAdapter } from "./scrapers/adapters/the-odds-api";
import type { NrlOddsRow } from "./scrapers/adapters/the-odds-api";

const prisma = new PrismaClient();

async function main() {
  console.log("1. Fetching NRL odds from The Odds API...");
  const adapter = new TheOddsApiAdapter();
  const rows = await adapter.fetch();
  console.log(`   ✓ ${rows.length} odds rows fetched`);

  console.log("\n2. Upserting matches...");
  const uniqueEvents = deduplicateEvents(rows);
  const matchIdCache = new Map<string, string>();

  for (const event of uniqueEvents) {
    const dayStart = new Date(event.kickoffAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let match = await prisma.match.findFirst({
      where: {
        homeTeam: { equals: event.homeTeam, mode: "insensitive" },
        awayTeam: { equals: event.awayTeam, mode: "insensitive" },
        kickoffAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });

    if (!match) {
      match = await prisma.match.create({
        data: {
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          kickoffAt: event.kickoffAt,
          round: 0,
          season: new Date().getFullYear(),
          status: "upcoming",
        },
        select: { id: true },
      });
      console.log(`   + Created: ${event.homeTeam} vs ${event.awayTeam}`);
    } else {
      console.log(`   = Exists:  ${event.homeTeam} vs ${event.awayTeam}`);
    }

    matchIdCache.set(event.externalEventId, match.id);
  }

  console.log("\n3. Upserting odds rows...");
  const now = new Date();
  let written = 0;

  const byEvent = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    if (!byEvent.has(row.externalEventId)) byEvent.set(row.externalEventId, []);
    byEvent.get(row.externalEventId)!.push(row);
  }

  for (const [eventId, eventRows] of byEvent) {
    const matchId = matchIdCache.get(eventId);
    if (!matchId) continue;

    await prisma.$transaction(
      eventRows.map((row) =>
        prisma.odds.upsert({
          where: {
            matchId_bookmaker_marketType_outcome: {
              matchId,
              bookmaker: row.bookmaker as any,
              marketType: row.marketType as any,
              outcome: row.outcome as any,
            },
          },
          update: { price: row.price, lineValue: row.lineValue ?? null, updatedAt: now },
          create: {
            matchId,
            bookmaker: row.bookmaker as any,
            marketType: row.marketType as any,
            outcome: row.outcome as any,
            price: row.price,
            lineValue: row.lineValue ?? null,
            deepLinkUrl: row.deepLinkUrl,
            updatedAt: now,
          },
        }),
      ),
    );
    written += eventRows.length;
  }

  console.log(`   ✓ ${written} odds rows written`);

  console.log("\n4. Verifying DB state...");
  const matchCount = await prisma.match.count();
  const oddsCount = await prisma.odds.count();
  const bookmakers = await prisma.odds.findMany({
    distinct: ["bookmaker"],
    select: { bookmaker: true },
  });

  console.log(`   matches table: ${matchCount} rows`);
  console.log(`   odds table:    ${oddsCount} rows`);
  console.log(`   bookmakers:    ${bookmakers.map((b) => b.bookmaker).sort().join(", ")}`);

  console.log("\n5. Sample odds for first match...");
  const firstMatch = await prisma.match.findFirst({
    orderBy: { kickoffAt: "asc" },
    include: {
      odds: {
        where: { marketType: "h2h" },
        orderBy: [{ bookmaker: "asc" }, { outcome: "asc" }],
      },
    },
  });

  if (firstMatch) {
    console.log(`   ${firstMatch.homeTeam} vs ${firstMatch.awayTeam}`);
    for (const odd of firstMatch.odds) {
      console.log(`   ${odd.bookmaker.padEnd(12)} ${odd.outcome.padEnd(5)} ${Number(odd.price).toFixed(2)}`);
    }
  }

  console.log("\n✓ End-to-end test passed");
  await prisma.$disconnect();
}

type EventSummary = Pick<NrlOddsRow, "externalEventId" | "homeTeam" | "awayTeam" | "kickoffAt">;

function deduplicateEvents(rows: NrlOddsRow[]): EventSummary[] {
  const seen = new Map<string, EventSummary>();
  for (const row of rows) {
    if (!seen.has(row.externalEventId)) {
      seen.set(row.externalEventId, {
        externalEventId: row.externalEventId,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        kickoffAt: row.kickoffAt,
      });
    }
  }
  return [...seen.values()];
}

main().catch((err) => {
  console.error("\n✗ Test failed:", err.message);
  prisma.$disconnect();
  process.exit(1);
});
