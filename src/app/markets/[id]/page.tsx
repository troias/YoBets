import { LineHistoryChart, MarketChart } from "@/components/edgeboard/charts";
import { AppShell } from "@/components/layout/app-shell";
import { sampleLineHistory } from "@/lib/mock-data";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell activePath="/dashboard">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Market {id}</h1>
        <div className="grid gap-4 lg:grid-cols-2">
          <MarketChart data={sampleLineHistory} />
          <LineHistoryChart data={sampleLineHistory} />
        </div>
      </div>
    </AppShell>
  );
}
