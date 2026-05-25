import { expectedValuePercent } from "@/lib/utils/odds";

export interface ValueScoreInput {
  winProbability: number;
  odds: number;
  marketDisagreement: number;
  sharpMovement: number;
  movementSpeed: number;
  bookmakerSoftness: number;
  clvAccuracy: number;
}

export function calculateValueScore(input: ValueScoreInput) {
  const ev = Math.max(0, Math.min(30, expectedValuePercent(input.winProbability, input.odds)));
  const weighted =
    ev * 0.35 +
    input.marketDisagreement * 0.2 +
    input.sharpMovement * 0.15 +
    input.movementSpeed * 0.1 +
    input.bookmakerSoftness * 0.1 +
    input.clvAccuracy * 0.1;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export function confidenceTier(score: number) {
  if (score >= 80) return "Elite";
  if (score >= 65) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

export function movementProbability(velocity: number, leaderMomentum: number, disagreement: number) {
  const probability = velocity * 0.4 + leaderMomentum * 0.35 + disagreement * 0.25;
  return Math.max(0, Math.min(100, Math.round(probability)));
}
