import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function EVCard({ market, evPercent, valueScore }: { market: string; evPercent: number; valueScore: number }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">Positive EV</div>
        <Badge variant={evPercent > 3 ? "success" : "warning"}>EV {evPercent.toFixed(2)}%</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-base font-semibold">{market}</div>
        <div className="mt-1 text-sm text-zinc-400">Value Score: {valueScore}/100</div>
      </CardContent>
    </Card>
  );
}
