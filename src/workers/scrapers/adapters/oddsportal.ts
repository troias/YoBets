// Scrapes NRL h2h, over/under, and asian-handicap odds from OddsPortal.
// Captures Bet365 AU which is not available via The Odds API.
// OddsPortal uses distinct URL paths per market — no tab-clicking needed.

import { chromium, type Browser, type Page } from "playwright";
import type { NrlOddsRow } from "./the-odds-api";

const BASE = "https://www.oddsportal.com";
const NRL_URL = `${BASE}/rugby-league/australia/nrl/`;
const TIMEOUT = 30_000;
const NAV_WAIT = 9_000;

// Market path → internal type + outcome mapping
const MARKETS: Array<{
  path: "h2h" | "over-under" | "asian-handicap";
  marketType: "h2h" | "total" | "line";
  sideA: string;
  sideB: string;
}> = [
  { path: "h2h",           marketType: "h2h",   sideA: "home",  sideB: "away"  },
  { path: "over-under",    marketType: "total",  sideA: "over",  sideB: "under" },
  { path: "asian-handicap", marketType: "line",  sideA: "home",  sideB: "away"  },
];

// Only ingest bookmakers not already covered by The Odds API
const TARGET_BOOKMAKERS = new Set(["bet365"]);

export class OddsPortalAdapter {
  private browser: Browser | null = null;

  async fetch(): Promise<NrlOddsRow[]> {
    try {
      this.browser = await chromium.launch({ headless: true });
      return await this.scrape();
    } catch (err) {
      console.warn("[OddsPortal] Scrape failed:", String(err).split("\n")[0]);
      return [];
    } finally {
      await this.browser?.close();
      this.browser = null;
    }
  }

  private async scrape(): Promise<NrlOddsRow[]> {
    const ctx = await this.browser!.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
    });

    const listPage = await ctx.newPage();
    const matches = await this.getUpcomingMatches(listPage);
    await listPage.close();

    if (matches.length === 0) {
      console.warn("[OddsPortal] No upcoming NRL matches found");
      await ctx.close();
      return [];
    }

    console.log(`[OddsPortal] ${matches.length} matches × ${MARKETS.length} markets`);
    const rows: NrlOddsRow[] = [];

    for (const match of matches) {
      for (const market of MARKETS) {
        try {
          const page = await ctx.newPage();
          const matchRows = await this.scrapeMarket(page, match, market);
          rows.push(...matchRows);
          await page.close();
          await delay(1000);
        } catch (err) {
          console.warn(
            `[OddsPortal] ${match.homeTeam} vs ${match.awayTeam} ${market.path}:`,
            String(err).split("\n")[0],
          );
        }
      }
    }

    await ctx.close();
    console.log(`[OddsPortal] Extracted ${rows.length} odds rows`);
    return rows;
  }

  private async getUpcomingMatches(page: Page): Promise<MatchMeta[]> {
    await page.goto(NRL_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(NAV_WAIT);

    return page.evaluate(() => {
      const seen = new Set<string>();
      const matches: MatchMeta[] = [];

      for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        if (!a.href.includes("/rugby-league/h2h/")) continue;
        if (a.href.includes("results") || a.href.includes("standings")) continue;
        if (seen.has(a.href)) continue;
        seen.add(a.href);

        const text = a.innerText.trim();
        if (/\d+\s*[–-]\s*\d+/.test(text)) continue; // skip finished

        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const timeIdx = lines.findIndex(l => /^\d{1,2}:\d{2}$/.test(l));
        if (timeIdx === -1) continue;
        const dashIdx = lines.indexOf("–", timeIdx);
        if (dashIdx === -1) continue;

        const homeTeam = lines.slice(timeIdx + 1, dashIdx).join(" ").trim();
        const awayTeam = lines.slice(dashIdx + 1).join(" ").trim();
        if (!homeTeam || !awayTeam) continue;

        // Extract the team-slug portion from the /h2h/ URL to build market URLs
        const slugMatch = a.href.match(/\/rugby-league\/h2h\/(.+)/);
        if (!slugMatch) continue;

        matches.push({ homeTeam, awayTeam, kickoffText: lines[timeIdx], slugPath: slugMatch[1] });
      }

      return matches;
    });
  }

  private async scrapeMarket(
    page: Page,
    match: MatchMeta,
    market: { path: string; marketType: "h2h" | "total" | "line"; sideA: string; sideB: string },
  ): Promise<NrlOddsRow[]> {
    const url = `${BASE}/rugby-league/${market.path}/${match.slugPath}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(NAV_WAIT);

    const text = await page.evaluate(() => document.body.innerText);
    return this.parseOdds(text, match, market);
  }

  private parseOdds(
    text: string,
    match: MatchMeta,
    market: { marketType: "h2h" | "total" | "line"; sideA: string; sideB: string },
  ): NrlOddsRow[] {
    const rows: NrlOddsRow[] = [];
    const kickoffAt = parseKickoff(text);
    const eventId = `oddsportal-${match.homeTeam}-${match.awayTeam}`;

    const bookmakerRows = extractBookmakerRows(text);
    if (!bookmakerRows) return rows;

    for (const { bookmaker, col1, col3 } of bookmakerRows) {
      const bk = bookmaker.toLowerCase().replace(/\s+/g, "");
      if (!TARGET_BOOKMAKERS.has(bk)) continue;

      const priceA = parseFloat(col1);
      const priceB = parseFloat(col3);
      if (!priceA || !priceB || priceA < 1.01 || priceB < 1.01) continue;

      const deepLink = "https://www.bet365.com.au/#/AS/B1/";

      rows.push({
        externalEventId: eventId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffAt,
        bookmaker: "bet365",
        marketType: market.marketType,
        outcome: market.sideA as "home" | "away" | "over" | "under",
        price: priceA,
        deepLinkUrl: deepLink,
      });

      rows.push({
        externalEventId: eventId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffAt,
        bookmaker: "bet365",
        marketType: market.marketType,
        outcome: market.sideB as "home" | "away" | "over" | "under",
        price: priceB,
        deepLinkUrl: deepLink,
      });
    }

    return rows;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type MatchMeta = {
  homeTeam: string;
  awayTeam: string;
  kickoffText: string;
  slugPath: string;
};

type BookmakerRow = { bookmaker: string; col1: string; col2: string; col3: string };

function extractBookmakerRows(text: string): BookmakerRow[] | null {
  const start = text.indexOf("Bookmakers");
  if (start === -1) return null;

  const section = text.slice(start, start + 4000);
  const lines = section.split("\n").map(l => l.trim()).filter(Boolean);
  const results: BookmakerRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const name = lines[i];
    if (!name || /^(Bookmakers|1|X|2|Payout|Full Time|1st Half|All|Classic|Crypto|Betting|My coupon|OddsAlert|Previous|H2H|Copyright)/.test(name)) {
      i++;
      continue;
    }
    if (/^\d/.test(name)) { i++; continue; }

    let j = i + 1;
    if (j < lines.length && /claim/i.test(lines[j])) j++;

    if (
      j + 2 < lines.length &&
      /^\d+\.\d+$/.test(lines[j]) &&
      /^\d+\.\d+$/.test(lines[j + 1]) &&
      /^\d+\.\d+$/.test(lines[j + 2])
    ) {
      results.push({ bookmaker: name, col1: lines[j], col2: lines[j + 1], col3: lines[j + 2] });
      i = j + 3;
      if (i < lines.length && /^\d+\.\d+%$/.test(lines[i])) i++;
    } else {
      i++;
    }
  }

  return results.length > 0 ? results : null;
}

function parseKickoff(text: string): Date {
  const m = text.match(/(\d{1,2}\s+\w+\s+\d{4})[,\s]+(\d{1,2}:\d{2})/);
  if (m) {
    const parsed = new Date(`${m[1]} ${m[2]} GMT+1100`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.now() + 86_400_000);
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
