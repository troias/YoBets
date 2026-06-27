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

// ─── Discord webhook ──────────────────────────────────────────────────────────

async function notifyDiscord(result: { oddsCount: number; matchCount: number; durationMs: number }, nextMs: number) {
  const config = await prisma.appConfig.findUnique({ where: { key: "DISCORD_WEBHOOK_URL" } }).catch(() => null);
  if (!config?.value) return;

  const nextMins = Math.round(nextMs / 60_000);
  const aest = new Date().toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true });

  const body = {
    embeds: [{
      color: 0x22c55e,
      title: "Odds updated",
      description: `${result.oddsCount} odds · ${result.matchCount} matches · ${(result.durationMs / 1000).toFixed(1)}s`,
      fields: [{ name: "Next update", value: `~${nextMins} min`, inline: true }],
      footer: { text: `EdgeBoard · ${aest} AEST` },
      url: process.env.NEXT_PUBLIC_APP_URL ?? "",
    }],
  };

  await fetch(config.value, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
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
      const nextPollAt = new Date(Date.now() + nextMs).toISOString();
      await prisma.appConfig.upsert({ where: { key: "next_poll_at" }, create: { label: "Next Poll At", key: "next_poll_at", value: nextPollAt }, update: { value: nextPollAt, updatedAt: new Date() } }).catch(() => {});
      console.log("[Worker] Mode is OFF — skipping poll, next check in 24h");
      return { oddsCount: 0, matchCount: 0, durationMs: 0, nextPollMs: nextMs };
    }

    const result = await runPollCycle();

    const nextMs = await calcNextPollMs();
    void oddsIngestionQueue.add("scrape:nrl", {}, { delay: nextMs });

    const nextPollAt = new Date(Date.now() + nextMs).toISOString();
    await prisma.appConfig.upsert({ where: { key: "next_poll_at" }, create: { label: "Next Poll At", key: "next_poll_at", value: nextPollAt }, update: { value: nextPollAt, updatedAt: new Date() } }).catch(() => {});

    void notifyDiscord(result, nextMs);

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
