import type { ArbitrageLeg, ArbitrageOpportunity } from "@/lib/types";

export function detectTwoWayArbitrage(legs: Omit<ArbitrageLeg, "stake">[], bankroll = 100): ArbitrageOpportunity | null {
  if (legs.length !== 2) return null;

  const inverseSum = legs.reduce((sum, leg) => sum + 1 / leg.odds, 0);
  if (inverseSum >= 1) return null;

  const stakes = legs.map((leg) => ({ ...leg, stake: bankroll / (leg.odds * inverseSum) }));
  const payout = stakes[0].stake * stakes[0].odds;
  const roiPercent = ((payout - bankroll) / bankroll) * 100;

  return {
    market: "2-way",
    roiPercent,
    guaranteedReturn: payout,
    totalStake: bankroll,
    legs: stakes,
  };
}

export function detectThreeWayArbitrage(legs: Omit<ArbitrageLeg, "stake">[], bankroll = 100): ArbitrageOpportunity | null {
  if (legs.length !== 3) return null;

  const inverseSum = legs.reduce((sum, leg) => sum + 1 / leg.odds, 0);
  if (inverseSum >= 1) return null;

  const stakes = legs.map((leg) => ({ ...leg, stake: bankroll / (leg.odds * inverseSum) }));
  const payout = stakes[0].stake * stakes[0].odds;
  const roiPercent = ((payout - bankroll) / bankroll) * 100;

  return {
    market: "3-way",
    roiPercent,
    guaranteedReturn: payout,
    totalStake: bankroll,
    legs: stakes,
  };
}
