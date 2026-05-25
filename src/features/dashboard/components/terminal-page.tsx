import { AppShell } from "@/components/layout/app-shell";
import { AlertModal } from "@/components/edgeboard/alert-modal";
import { ArbCard } from "@/components/edgeboard/arb-card";
import { BetCalculator } from "@/components/edgeboard/bet-calculator";
import { EVCard } from "@/components/edgeboard/ev-card";
import { LineHistoryChart, MarketChart } from "@/components/edgeboard/charts";
import { LiveTicker } from "@/components/edgeboard/live-ticker";
import { OddsTable } from "@/components/edgeboard/odds-table";
import { SportsbookBadge } from "@/components/edgeboard/sportsbook-badge";
import { SteamMoveFeed } from "@/components/edgeboard/steam-move-feed";
import { sampleArb, sampleLineHistory, sampleOddsRows } from "@/lib/mock-data";

export function TerminalPage({
  title,
  subtitle,
  activePath,
}: {
  title: string;
  subtitle: string;
  activePath: string;
}) {
  return (
    <AppShell activePath={activePath}>
      <div className="space-y-4">
        <header className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-zinc-400">{subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SportsbookBadge name="Bet365" sharp />
            <SportsbookBadge name="Sportsbet" />
            <SportsbookBadge name="TAB" />
            <SportsbookBadge name="Ladbrokes" />
            <SportsbookBadge name="Neds" />
          </div>
        </header>

        <LiveTicker items={[
          "Best Price Available: Broncos 2.15 (Bet365)",
          "Market Just Moved: Roosters 1.78 -> 1.71",
          "Bet365 Steam Alert: Anytime Try Scorer shortening",
        ]} />

        <section className="grid gap-4 md:grid-cols-3">
          <EVCard market="NRL Head to Head" evPercent={8.6} valueScore={86} />
          <ArbCard opportunity={sampleArb} />
          <BetCalculator />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <OddsTable data={sampleOddsRows} />
          <SteamMoveFeed
            moves={[
              { market: "Broncos H2H", confidence: 87, books: ["TAB", "Bet365"] },
              { market: "Anytime Try Scorer", confidence: 71, books: ["Sportsbet", "Neds"] },
            ]}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <MarketChart data={sampleLineHistory} />
          <LineHistoryChart data={sampleLineHistory} />
        </section>

        <AlertModal />
      </div>
    </AppShell>
  );
}
