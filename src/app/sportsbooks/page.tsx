import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const tier1 = ["Bet365 Australia", "Sportsbet", "TAB", "Ladbrokes", "Neds"];
const tier2 = ["PointsBet Australia", "BetRight", "Palmerbet", "Unibet Australia", "BlueBet", "Dabble"];

export default function SportsbooksPage() {
  return (
    <AppShell activePath="/sportsbooks">
      <Card>
        <CardHeader>Australian Sportsbook Coverage</CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm text-zinc-400">Tier 1 Priority</h3>
            <ul className="space-y-1 text-sm">{tier1.map((book) => <li key={book}>{book}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm text-zinc-400">Tier 2</h3>
            <ul className="space-y-1 text-sm">{tier2.map((book) => <li key={book}>{book}</li>)}</ul>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
