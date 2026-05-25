export function impliedProbability(oddsDecimal: number) {
  return oddsDecimal > 0 ? 1 / oddsDecimal : 0;
}

export function fairOddsFromConsensus(consensusProbability: number) {
  return consensusProbability > 0 ? 1 / consensusProbability : 0;
}

export function expectedValuePercent(winProbability: number, odds: number) {
  return ((winProbability * odds - 1) * 100);
}

export function consensusProbability(oddsValues: number[]) {
  const implied = oddsValues.map(impliedProbability);
  const total = implied.reduce((sum, value) => sum + value, 0);
  return total / Math.max(implied.length, 1);
}
