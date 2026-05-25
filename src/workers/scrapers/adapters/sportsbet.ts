import type { ScrapedEvent, SportsbookAdapter } from "@/workers/scrapers/base";

export class SportsbetAdapter implements SportsbookAdapter {
  key = "sportsbet_au";

  async scrape(): Promise<ScrapedEvent[]> {
    return [];
  }
}
