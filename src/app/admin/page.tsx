import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <AppShell activePath="/admin">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>Scraper Health</CardHeader>
          <CardContent className="text-sm text-zinc-300">Monitor adapter status, failures and latency.</CardContent>
        </Card>
        <Card>
          <CardHeader>Worker Status</CardHeader>
          <CardContent className="text-sm text-zinc-300">BullMQ queue depth, throughput and retries.</CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
