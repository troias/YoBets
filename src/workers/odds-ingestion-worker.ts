import { Worker } from "bullmq";
import { redis } from "@/workers/queue/connection";
import { Bet365Adapter } from "@/workers/scrapers/adapters/bet365";
import { LadbrokesAdapter } from "@/workers/scrapers/adapters/ladbrokes";
import { SportsbetAdapter } from "@/workers/scrapers/adapters/sportsbet";
import { TabAdapter } from "@/workers/scrapers/adapters/tab";

const adapters = {
  bet365_au: new Bet365Adapter(),
  sportsbet_au: new SportsbetAdapter(),
  tab_au: new TabAdapter(),
  ladbrokes_au: new LadbrokesAdapter(),
};

new Worker(
  "odds-ingestion",
  async (job) => {
    const key = String(job.data.sportsbookKey) as keyof typeof adapters;
    const adapter = adapters[key];

    if (!adapter) {
      throw new Error(`No adapter registered for ${key}`);
    }

    const events = await adapter.scrape();

    return {
      sportsbook: key,
      eventsCount: events.length,
      capturedAt: new Date().toISOString(),
    };
  },
  {
    connection: redis,
    concurrency: 8,
  },
);
