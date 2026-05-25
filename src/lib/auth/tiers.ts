import type { SubscriptionTier } from "@/lib/types";

export const tierFeatures: Record<SubscriptionTier, string[]> = {
  FREE: ["basic_dashboard", "basic_live_odds"],
  PRO: [
    "basic_dashboard",
    "basic_live_odds",
    "bet365_premium_alerts",
    "advanced_nrl_analytics",
    "advanced_arb_scanner",
    "historical_line_database",
  ],
  ENTERPRISE: [
    "basic_dashboard",
    "basic_live_odds",
    "bet365_premium_alerts",
    "advanced_nrl_analytics",
    "advanced_arb_scanner",
    "historical_line_database",
    "api_access",
    "team_management",
  ],
};

export function hasFeature(tier: SubscriptionTier, feature: string) {
  return tierFeatures[tier].includes(feature);
}
