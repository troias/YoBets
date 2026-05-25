import type { ScrapedEvent, SportsbookAdapter } from "@/workers/scrapers/base";

export class LadbrokesAdapter implements SportsbookAdapter {
  key = "ladbrokes_au";

  async scrape(): Promise<ScrapedEvent[]> {
    return [];
  }
}
