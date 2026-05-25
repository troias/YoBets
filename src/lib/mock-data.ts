import type { ArbitrageOpportunity, OddsPoint, OddsRow } from "@/lib/types";

export const sampleOddsRows: OddsRow[] = [
  {
    eventId: "e1",
    eventName: "Broncos vs Roosters",
    market: "Head to Head",
    selection: "Broncos",
    sportsbook: "Bet365",
    odds: 2.15,
    fairOdds: 1.98,
    evPercent: 8.6,
    valueScore: 86,
    updatedAt: new Date().toISOString(),
  },
  {
    eventId: "e1",
    eventName: "Broncos vs Roosters",
    market: "Try Scorer",
    selection: "Reece Walsh Anytime",
    sportsbook: "Sportsbet",
    odds: 2.7,
    fairOdds: 2.52,
    evPercent: 7.1,
    valueScore: 73,
    updatedAt: new Date().toISOString(),
  },
];

export const sampleArb: ArbitrageOpportunity = {
  market: "NRL Head to Head",
  roiPercent: 2.3,
  guaranteedReturn: 102.3,
  totalStake: 100,
  legs: [
    { sportsbook: "Bet365", selection: "Broncos", odds: 2.15, stake: 48.2 },
    { sportsbook: "TAB", selection: "Roosters", odds: 2.1, stake: 51.8 },
  ],
};

export const sampleLineHistory: OddsPoint[] = [
  { timestamp: "09:00", odds: 2.28 },
  { timestamp: "10:00", odds: 2.22 },
  { timestamp: "11:00", odds: 2.15 },
  { timestamp: "12:00", odds: 2.1 },
  { timestamp: "13:00", odds: 2.05 },
];
