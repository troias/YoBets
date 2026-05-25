import type { ScrapedEvent, SportsbookAdapter } from "@/workers/scrapers/base";

export class TabAdapter implements SportsbookAdapter {
  key = "tab_au";

  async scrape(): Promise<ScrapedEvent[]> {
    return [];
  }
}
