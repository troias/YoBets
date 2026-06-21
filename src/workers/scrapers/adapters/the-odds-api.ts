// Fetches NRL odds for all available AU bookmakers from The Odds API.
// Bet365 AU is not available via this provider — handled by bet365.ts scraper.

const API_BASE = "https://api.the-odds-api.com/v4";

type KnownBookmaker =
  | "sportsbet"
  | "tab"
  | "ladbrokes"
  | "neds"
  | "pointsbet"
  | "unibet"
  | "betright"
  | "betr"
  | "betfair"
  | "tabtouch"
  | "playup";

const BOOKMAKER_MAP: Record<string, KnownBookmaker> = {
  sportsbet:       "sportsbet",
  tab:             "tab",
  ladbrokes_au:    "ladbrokes",
  neds:            "neds",
  pointsbetau:     "pointsbet",
  unibet:          "unibet",
  betright:        "betright",
  betr_au:         "betr",
  betfair_ex_au:   "betfair",
  tabtouch:        "tabtouch",
  playup:          "playup",
};

const ALL_BOOKMAKER_KEYS = Object.keys(BOOKMAKER_MAP).join(",");

const MARKET_MAP: Record<string, "h2h" | "line" | "total"> = {
  h2h:     "h2h",
  spreads: "line",
  totals:  "total",
};

const DEEP_LINKS: Record<KnownBookmaker, string> = {
  sportsbet: "https://www.sportsbet.com.au/betting/rugby-league",
  tab:       "https://www.tab.com.au/sports/betting/Rugby%20League",
  ladbrokes: "https://www.ladbrokes.com.au/sports/rugby-league",
  neds:      "https://www.neds.com.au/sports/rugby-league",
  pointsbet: "https://pointsbet.com.au/sports/rugby-league",
  unibet:    "https://www.unibet.com.au/betting/sports/rugby-league",
  betright:  "https://betright.com.au/sports/rugby-league",
  betr:      "https://betr.com.au/sports/rugby-league",
  betfair:   "https://www.betfair.com.au/exchange/plus/rugby-league",
  tabtouch:  "https://www.tabtouch.com.au/sports/rugby-league",
  playup:    "https://www.playup.com.au/sports/rugby-league",
};

export type NrlOddsRow = {
  externalEventId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  bookmaker: KnownBookmaker | "bet365";
  marketType: "h2h" | "line" | "total";
  outcome: "home" | "away" | "over" | "under";
  price: number;
  lineValue?: number;
  deepLinkUrl: string;
};

interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface ApiMarket {
  key: string;
  outcomes: ApiOutcome[];
}

interface ApiBookmaker {
  key: string;
  markets: ApiMarket[];
}

interface ApiEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: ApiBookmaker[];
}

export class TheOddsApiAdapter {
  async fetch(): Promise<NrlOddsRow[]> {
    const url = new URL(`${API_BASE}/sports/rugbyleague_nrl/odds`);
    url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY!);
    url.searchParams.set("regions", "au");
    url.searchParams.set("markets", "h2h,spreads,totals");
    url.searchParams.set("bookmakers", ALL_BOOKMAKER_KEYS);
    url.searchParams.set("oddsFormat", "decimal");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`The Odds API ${res.status}: ${await res.text()}`);
    }

    const remaining = res.headers.get("x-requests-remaining");
    if (remaining && Number(remaining) < 50) {
      console.warn(`[TheOddsApi] Low quota: ${remaining} requests remaining`);
    }

    const events: ApiEvent[] = await res.json();
    const rows: NrlOddsRow[] = [];

    for (const event of events) {
      for (const bookmaker of event.bookmakers) {
        const bk = BOOKMAKER_MAP[bookmaker.key];
        if (!bk) continue;

        for (const market of bookmaker.markets) {
          const mt = MARKET_MAP[market.key];
          if (!mt) continue;

          for (const apiOutcome of market.outcomes) {
            const oc = resolveOutcome(apiOutcome.name, event.home_team, event.away_team);
            if (!oc) continue;

            rows.push({
              externalEventId: event.id,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              kickoffAt: new Date(event.commence_time),
              bookmaker: bk,
              marketType: mt,
              outcome: oc,
              price: apiOutcome.price,
              lineValue: apiOutcome.point,
              deepLinkUrl: DEEP_LINKS[bk],
            });
          }
        }
      }
    }

    return rows;
  }
}

function resolveOutcome(
  name: string,
  homeTeam: string,
  awayTeam: string,
): "home" | "away" | "over" | "under" | null {
  if (name === homeTeam) return "home";
  if (name === awayTeam) return "away";
  if (name === "Over") return "over";
  if (name === "Under") return "under";
  return null;
}
