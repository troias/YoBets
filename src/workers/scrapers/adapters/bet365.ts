import { chromium } from "playwright";
import type { ScrapedEvent, SportsbookAdapter } from "@/workers/scrapers/base";

export class Bet365Adapter implements SportsbookAdapter {
  key = "bet365_au";

  async scrape(): Promise<ScrapedEvent[]> {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.goto("https://example.com/bet365-placeholder", { waitUntil: "domcontentloaded" });

      return [
        {
          externalEventId: "bet365-e1",
          sport: "NRL",
          league: "NRL",
          eventName: "Broncos vs Roosters",
          startsAt: new Date().toISOString(),
          markets: [
            {
              marketName: "Head to Head",
              selections: [
                { selection: "Broncos", oddsDecimal: 2.15 },
                { selection: "Roosters", oddsDecimal: 1.78 },
              ],
            },
          ],
        },
      ];
    } finally {
      await browser.close();
    }
  }
}
