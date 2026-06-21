// Bet365 AU NRL odds via Playwright — not available on The Odds API.
//
// Deployment requirements:
//   - Must run from an Australian IP (Bet365 geo-blocks non-AU addresses)
//   - On Railway: deploy worker to the Sydney region
//   - Locally: will fail behind FortiGuard/corporate filters that block gambling sites

import { chromium, type Browser } from "playwright";
import type { NrlOddsRow } from "./the-odds-api";

const BET365_NRL_URL = "https://www.bet365.com.au/#/AS/B1/";
const DEEP_LINK = "https://www.bet365.com.au/#/AS/B1/";
const TIMEOUT_MS = 25_000;

// Bet365 use obfuscated class names that rotate on deploy.
// These selectors target structural patterns and data attributes that are more stable.
const SELECTORS = {
  // Each fixture row containing two participants
  fixtureRow: [
    "[class*='rcl-ParticipantFixtureDetails']",
    "[class*='gl-Market_General']",
    "[class*='ovm-Fixture']",
  ],
  // Team name within a fixture
  participant: [
    "[class*='rcl-ParticipantFixtureDetails_TeamName']",
    "[class*='gl-Participant_Name']",
    "[class*='ovm-Fixture_TeamName']",
  ],
  // Odds button price text
  oddsButton: [
    "[class*='gl-Participant_OddsText']",
    "[class*='ovm-Participant_OddsText']",
    "[class*='gll-Odds_Value']",
  ],
};

export class Bet365Adapter {
  private browser: Browser | null = null;

  async fetch(): Promise<NrlOddsRow[]> {
    try {
      this.browser = await chromium.launch({ headless: true });
      return await this.scrapeNrl();
    } catch (err) {
      // Fail gracefully — worker continues with other bookmaker data
      console.warn("[Bet365] Scrape failed, skipping:", String(err).split("\n")[0]);
      return [];
    } finally {
      await this.browser?.close();
      this.browser = null;
    }
  }

  private async scrapeNrl(): Promise<NrlOddsRow[]> {
    const ctx = await this.browser!.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
      ignoreHTTPSErrors: true,
    });

    const page = await ctx.newPage();

    await page.goto(BET365_NRL_URL, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });

    // Wait for odds to render — Bet365 loads via WebSocket, allow time
    await page.waitForTimeout(5000);

    // Detect hard blocks before attempting extraction
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    if (/blocked|cloudflare|challenge|captcha|access denied|fortiguard/i.test(bodyText)) {
      throw new Error(`Page blocked: ${bodyText.slice(0, 100)}`);
    }

    const rows = await page.evaluate(
      ({ fixtureSelectors, participantSelectors, oddsSelectors }) => {
        function tryQueryAll(el: Element | Document, selectors: string[]): Element[] {
          for (const sel of selectors) {
            const found = Array.from(el.querySelectorAll(sel));
            if (found.length > 0) return found;
          }
          return [];
        }

        const fixtures = tryQueryAll(document, fixtureSelectors);
        if (fixtures.length === 0) return [];

        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          homeOdds: number;
          awayOdds: number;
          kickoffText: string;
        }> = [];

        for (const fixture of fixtures) {
          const participants = tryQueryAll(fixture, participantSelectors);
          const oddsBtns = tryQueryAll(fixture, oddsSelectors);

          if (participants.length < 2 || oddsBtns.length < 2) continue;

          const homeTeam = participants[0].textContent?.trim() ?? "";
          const awayTeam = participants[1].textContent?.trim() ?? "";
          const homeOdds = parseFloat(oddsBtns[0].textContent?.trim() ?? "0");
          const awayOdds = parseFloat(oddsBtns[1].textContent?.trim() ?? "0");

          if (!homeTeam || !awayTeam || isNaN(homeOdds) || isNaN(awayOdds)) continue;
          if (homeOdds < 1.01 || awayOdds < 1.01) continue;

          // Kickoff time — Bet365 shows it near the fixture, grab whatever text is close
          const kickoffEl = fixture.previousElementSibling;
          const kickoffText = kickoffEl?.textContent?.trim() ?? "";

          results.push({ homeTeam, awayTeam, homeOdds, awayOdds, kickoffText });
        }

        return results;
      },
      {
        fixtureSelectors: SELECTORS.fixtureRow,
        participantSelectors: SELECTORS.participant,
        oddsSelectors: SELECTORS.oddsButton,
      },
    );

    await ctx.close();

    if (rows.length === 0) {
      console.warn("[Bet365] No fixtures extracted — selectors may need updating");
      return [];
    }

    console.log(`[Bet365] Extracted ${rows.length} NRL fixtures`);

    const now = new Date();
    const nrlRows: NrlOddsRow[] = [];

    for (const row of rows) {
      // Bet365 doesn't expose a machine-readable kickoff time in the DOM easily.
      // Use current time + 24h as a fallback; match resolution uses team names + date anyway.
      const kickoffAt = parseKickoff(row.kickoffText) ?? new Date(now.getTime() + 86_400_000);

      nrlRows.push({
        externalEventId: `bet365-${row.homeTeam}-${row.awayTeam}`,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        kickoffAt,
        bookmaker: "bet365",
        marketType: "h2h",
        outcome: "home",
        price: row.homeOdds,
        deepLinkUrl: DEEP_LINK,
      });

      nrlRows.push({
        externalEventId: `bet365-${row.homeTeam}-${row.awayTeam}`,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        kickoffAt,
        bookmaker: "bet365",
        marketType: "h2h",
        outcome: "away",
        price: row.awayOdds,
        deepLinkUrl: DEEP_LINK,
      });
    }

    return nrlRows;
  }
}

// Bet365 shows kickoff as "Today HH:MM" or "Tomorrow HH:MM" or "Day DD Mon HH:MM"
function parseKickoff(text: string): Date | null {
  if (!text) return null;
  try {
    const now = new Date();
    const aest = new Date(now.toLocaleString("en-AU", { timeZone: "Australia/Sydney" }));

    if (/today/i.test(text)) {
      const time = text.match(/(\d{1,2}):(\d{2})/);
      if (time) {
        aest.setHours(parseInt(time[1]), parseInt(time[2]), 0, 0);
        return aest;
      }
    }
    if (/tomorrow/i.test(text)) {
      aest.setDate(aest.getDate() + 1);
      const time = text.match(/(\d{1,2}):(\d{2})/);
      if (time) {
        aest.setHours(parseInt(time[1]), parseInt(time[2]), 0, 0);
        return aest;
      }
    }
    // Fallback: let Date.parse try
    const parsed = Date.parse(text);
    return isNaN(parsed) ? null : new Date(parsed);
  } catch {
    return null;
  }
}
