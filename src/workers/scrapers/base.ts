export type ScrapedSelection = {
  selection: string;
  oddsDecimal: number;
};

export type ScrapedMarket = {
  marketName: string;
  line?: number;
  selections: ScrapedSelection[];
};

export type ScrapedEvent = {
  externalEventId: string;
  sport: string;
  league: string;
  eventName: string;
  startsAt: string;
  markets: ScrapedMarket[];
};

export interface SportsbookAdapter {
  key: string;
  scrape(): Promise<ScrapedEvent[]>;
}

export function normalizeMarketName(name: string) {
  const map: Record<string, string> = {
    "h2h": "Head to Head",
    "head-to-head": "Head to Head",
    "spread": "Line",
    "line": "Line",
    "total": "Total Points",
    "anytime tryscorer": "Anytime Try Scorer",
    "first tryscorer": "First Try Scorer",
  };

  const normalized = name.trim().toLowerCase();
  return map[normalized] ?? name;
}
