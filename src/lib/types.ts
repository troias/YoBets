export type SubscriptionTier = "FREE" | "PRO" | "ENTERPRISE";

export type SportKey = "NRL" | "AFL" | "NBA" | "SOCCER" | "TENNIS" | "UFC" | "CRICKET";

export interface OddsPoint {
  timestamp: string;
  odds: number;
}

export interface OddsRow {
  eventId: string;
  eventName: string;
  market: string;
  selection: string;
  sportsbook: string;
  odds: number;
  fairOdds: number;
  evPercent: number;
  valueScore: number;
  updatedAt: string;
}

export interface ArbitrageLeg {
  sportsbook: string;
  selection: string;
  odds: number;
  stake: number;
}

export interface ArbitrageOpportunity {
  market: string;
  roiPercent: number;
  guaranteedReturn: number;
  totalStake: number;
  legs: ArbitrageLeg[];
}

export interface MarketMovementSignal {
  eventId: string;
  market: string;
  confidence: number;
  direction: "SHORTEN" | "DRIFT" | "FLAT";
  leadingBooks: string[];
  laggingBooks: string[];
}
