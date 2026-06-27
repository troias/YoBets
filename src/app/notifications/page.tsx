import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { getSubscriptionStatus, isSubscribed, isAdminEmail } from "@/lib/subscription";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = {
  arb:   "Arb alert",
  ev:    "+EV alert",
  steam: "Steam move",
  hot:   "Hot market",
  price: "Price target",
};

const TYPE_COLOR: Record<string, string> = {
  arb:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ev:    "text-green-400 bg-green-500/10 border-green-500/20",
  steam: "text-red-400 bg-red-500/10 border-red-500/20",
  hot:   "text-orange-400 bg-orange-500/10 border-orange-500/20",
  price: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

function parseKey(alertType: string, key: string): { summary: string; detail: string } {
  if (alertType === "arb") {
    const parts = key.split("|");
    if (parts.length >= 4) {
      const matchId = parts[0];
      const home = parts[2] ?? "";
      const away = parts[3] ?? "";
      return {
        summary: `Arb opportunity`,
        detail: `${home} / ${away}${matchId ? ` · match ${matchId.slice(0, 6)}` : ""}`,
      };
    }
  }
  if (alertType === "ev") {
    const parts = key.split("|");
    return {
      summary: "+EV bet appeared",
      detail: parts.slice(1).join(" · "),
    };
  }
  if (alertType === "steam") {
    const parts = key.split("|");
    return {
      summary: "Steam move detected",
      detail: parts.join(" · "),
    };
  }
  if (alertType === "price") {
    const parts = key.split("|");
    return {
      summary: "Price target hit",
      detail: parts.join(" · "),
    };
  }
  return { summary: TYPE_LABEL[alertType] ?? alertType, detail: key };
}

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const subStatus = await getSubscriptionStatus(user.id);
  const subscribed = isSubscribed(subStatus) || isAdminEmail(user.email);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const alerts = subscribed
    ? await prisma.alertLog.findMany({
        where: { userId: user.id, sentAt: { gte: thirtyDaysAgo } },
        orderBy: { sentAt: "desc" },
        take: 100,
      })
    : [];

  const countByType: Record<string, number> = {};
  for (const a of alerts) {
    countByType[a.alertType] = (countByType[a.alertType] ?? 0) + 1;
  }

  return (
    <AppShell activePath="/notifications" userEmail={user.email}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Notification History</h1>
          <p className="text-sm text-zinc-400">Alerts sent to you in the last 30 days</p>
        </div>

        {!subscribed ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">Notification history is a Pro feature</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Upgrade to Pro to receive push, email, and SMS alerts — and see a full log of every alert sent.
            </p>
            <Link href="/pricing"
              className="inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400">
              Start free trial →
            </Link>
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-300">No alerts in the last 30 days</p>
            <p className="text-xs text-zinc-500">
              Make sure your notification preferences are configured in{" "}
              <Link href="/settings" className="text-amber-500 hover:text-amber-400 transition">Settings</Link>.
              Alerts fire when a price target hits, an arb opens, a +EV bet appears, or sharp money moves a line.
            </p>
          </div>
        ) : (
          <>
            {/* Summary counts */}
            {Object.keys(countByType).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(countByType).map(([type, count]) => (
                  <span key={type}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${TYPE_COLOR[type] ?? "text-zinc-400 bg-zinc-900 border-zinc-800"}`}>
                    {count} {TYPE_LABEL[type] ?? type}{count !== 1 ? "s" : ""}
                  </span>
                ))}
              </div>
            )}

            {/* Alert list */}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 divide-y divide-zinc-800/60">
              {alerts.map(alert => {
                const { summary, detail } = parseKey(alert.alertType, alert.key);
                const sentAt = alert.sentAt.toLocaleString("en-AU", {
                  timeZone: "Australia/Sydney",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                return (
                  <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[alert.alertType] ?? "text-zinc-400 bg-zinc-900 border-zinc-800"}`}>
                          {TYPE_LABEL[alert.alertType] ?? alert.alertType}
                        </span>
                        <span className="truncate text-sm text-zinc-200">{summary}</span>
                      </div>
                      {detail && <p className="truncate text-xs text-zinc-500">{detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-600">{sentAt} AEST</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
