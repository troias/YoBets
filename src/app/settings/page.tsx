import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <AppShell activePath="/settings">
      <Card>
        <CardHeader>Settings & Alerts</CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-300">
          <div>- EV threshold alerts</div>
          <div>- Odds movement alerts</div>
          <div>- Arbitrage alerts</div>
          <div>- Team/market watchlists</div>
          <div>- Placeholder channels: email, Telegram, Discord webhook</div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
