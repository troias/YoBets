import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "@/workers/queue/connection";
import { oddsIngestionQueue } from "@/workers/queue/queues";
import { TheOddsApiAdapter } from "@/workers/scrapers/adapters/the-odds-api";
import { Bet365Adapter } from "@/workers/scrapers/adapters/bet365";
import type { NrlOddsRow } from "@/workers/scrapers/adapters/the-odds-api";

const prisma = new PrismaClient();
const oddsApiAdapter = new TheOddsApiAdapter();
const bet365Adapter = new Bet365Adapter();

// Register repeating job on startup (idempotent — safe to re-run)
await oddsIngestionQueue.add(
  "scrape:nrl",
  {},
  {
    jobId: "scrape:nrl:repeating",
    repeat: { every: 120_000 }, // 2 minutes — switch to 30_000 when in-play detection is added
  },
);

// Match ID cache: avoids re-querying the DB for the same match within one poll cycle
const matchIdCache = new Map<string, string>();

new Worker(
  "odds-ingestion",
  async () => {
    const started = Date.now();

    // Fetch from all sources in parallel — Bet365 failure doesn't block the rest
    const [apiRows, bet365Rows] = await Promise.all([
      oddsApiAdapter.fetch().catch((err) => {
        console.error("[Worker] TheOddsApi fetch failed:", err.message);
        return [] as NrlOddsRow[];
      }),
      bet365Adapter.fetch().catch((err) => {
        console.error("[Worker] Bet365 fetch failed:", err.message);
        return [] as NrlOddsRow[];
      }),
    ]);

    const rows = [...apiRows, ...bet365Rows];
    if (rows.length === 0) {
      console.warn("[Worker] No odds rows returned from any source");
      return { oddsCount: 0, matchCount: 0, durationMs: Date.now() - started };
    }

    // Auto-create missing match records, grouped by event so we only upsert once per match
    const uniqueEvents = deduplicateEvents(rows);
    await upsertMatches(uniqueEvents);

    // Write all odds rows
    const oddsCount = await upsertOdds(rows);

    const durationMs = Date.now() - started;
    console.log(`[Worker] Done — ${oddsCount} odds rows, ${uniqueEvents.length} matches, ${durationMs}ms`);

    return { oddsCount, matchCount: uniqueEvents.length, durationMs };
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

console.log("[Worker] Odds ingestion worker started — polling every 2 minutes");

// ─── Helpers ────────────────────────────────────────────────────────────────

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

async function upsertMatches(events: EventSummary[]): Promise<void> {
  for (const event of events) {
    const cacheKey = event.externalEventId;
    if (matchIdCache.has(cacheKey)) continue;

    // Find by team names + kickoff date (tolerates minor time differences between sources)
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
          round: 0,   // Unknown until we add a fixture source — set via dashboard if needed
          season: new Date().getFullYear(),
          status: "upcoming",
        },
        select: { id: true },
      });
    }

    matchIdCache.set(cacheKey, match.id);
  }
}

async function upsertOdds(rows: NrlOddsRow[]): Promise<number> {
  const now = new Date();
  let count = 0;

  // Group by match so we can batch per-match in a transaction
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
          update: {
            price: row.price,
            lineValue: row.lineValue ?? null,
            deepLinkUrl: row.deepLinkUrl,
            updatedAt: now,
          },
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

    count += eventRows.length;
  }

  return count;
}
