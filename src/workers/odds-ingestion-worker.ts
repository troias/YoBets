import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "@/workers/queue/connection";
import { oddsIngestionQueue } from "@/workers/queue/queues";
import { runPollCycle } from "@/lib/poll-cycle";

const prisma = new PrismaClient();

type AlertPrefRow = { userId: string; email: string | null; phone: string | null; alertNewArb: boolean; minArbRoi: number | string; alertSteamMove: boolean; steamMoveThreshold: number | string; alertHighEv: boolean; minEvPercent: number | string; alertHotBets: boolean; hotBetsThreshold: number | string };
type PushSubRow   = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };
type AlertLogRow  = { id: string; userId: string; alertType: string; key: string; sentAt: Date };
type MatchAlertRow = { id: string; userId: string; matchId: string; alertType: string; threshold: number | string | null };

// ─── Worker mode ─────────────────────────────────────────────────────────────

async function getWorkerMode(): Promise<"production" | "slow" | "off"> {
  const row = await prisma.appConfig.findUnique({ where: { key: "worker_mode" } });
  const v = row?.value ?? "production";
  if (v === "slow" || v === "off") return v;
  return "production";
}

async function calcNextPollMs(): Promise<number> {
  const mode = await getWorkerMode();
  if (mode === "off") return 24 * 60 * 60_000;

  const mul = mode === "slow" ? 6 : 1;

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const next = await prisma.match.findFirst({
    where: { kickoffAt: { gte: now, lte: sevenDaysOut }, status: "upcoming" },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });

  if (!next) return mul * 6 * 60 * 60_000;

  const hoursOut = (next.kickoffAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursOut < 3)  return mul * 2  * 60_000;
  if (hoursOut < 24) return mul * 5  * 60_000;
  if (hoursOut < 72) return mul * 15 * 60_000;
  return mul * 60 * 60_000;
}

// ─── BullMQ worker ────────────────────────────────────────────────────────────

void oddsIngestionQueue.add("scrape:nrl", {}, { jobId: "scrape:nrl:boot" });

const worker = new Worker(
  "odds-ingestion",
  async () => {
    const mode = await getWorkerMode();
    if (mode === "off") {
      const nextMs = 24 * 60 * 60_000;
      void oddsIngestionQueue.add("scrape:nrl", {}, { delay: nextMs });
      console.log("[Worker] Mode is OFF — skipping poll, next check in 24h");
      return { oddsCount: 0, matchCount: 0, durationMs: 0, nextPollMs: nextMs };
    }

    const result = await runPollCycle();

    const nextMs = await calcNextPollMs();
    void oddsIngestionQueue.add("scrape:nrl", {}, { delay: nextMs });

    console.log(`[Worker] Done — ${result.oddsCount} odds, ${result.matchCount} matches, ${result.durationMs}ms · next poll in ${Math.round(nextMs / 60_000)}min`);

    return { ...result, nextPollMs: nextMs };
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

console.log("[Worker] Odds ingestion worker started");

// Suppress unhandled rejection on graceful shutdown
worker.on("error", (err) => console.error("[Worker] Error:", err.message));
