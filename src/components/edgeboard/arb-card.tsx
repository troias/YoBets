import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ArbitrageOpportunity } from "@/lib/types";

export function ArbCard({ opportunity }: { opportunity: ArbitrageOpportunity }) {
  return (
    <Card>
      <CardHeader>
        <div className="text-sm text-zinc-400">Arbitrage Opportunity</div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>ROI: <span className="text-emerald-300">{opportunity.roiPercent.toFixed(2)}%</span></div>
        <div>Guaranteed Return: {opportunity.guaranteedReturn.toFixed(2)}</div>
        <div className="text-zinc-400">Books: {opportunity.legs.map((leg) => leg.sportsbook).join(", ")}</div>
      </CardContent>
    </Card>
  );
}
