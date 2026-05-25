import { Queue } from "bullmq";
import { redis } from "@/workers/queue/connection";

export const oddsIngestionQueue = new Queue("odds-ingestion", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

export type OddsIngestionJob = {
  sportsbookKey: string;
  sport: string;
  league?: string;
};
