import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import { AppShell } from "@/components/layout/app-shell";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import prisma from "@/lib/prisma";
import { saveAlertPrefs, addMatchAlert, deleteMatchAlert } from "@/app/actions/alert-prefs";
import { PushToggle } from "@/components/push-toggle";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial active",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  inactive: "No subscription",
};

const STATUS_COLOR: Record<string, string> = {
  active: "text-green-400",
  trialing: "text-emerald-400",
  past_due: "text-amber-400",
  canceled: "text-red-400",
  inactive: "text-zinc-500",
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  best_odds:  "Best odds change",
  line_move:  "Significant line move",
  arb:        "Arbitrage opportunity",
};

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [status, sub, alertPrefs, matchAlerts, upcomingMatches] = await Promise.all([
    getSubscriptionStatus(user.id),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.alertPreferences.findUnique({ where: { userId: user.id } }),
    prisma.matchAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.match.findMany({
      where: { status: "upcoming" },
      orderBy: { kickoffAt: "asc" },
      take: 20,
      select: { id: true, homeTeam: true, awayTeam: true, kickoffAt: true },
    }),
  ]);

  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
  const matchMap = new Map(upcomingMatches.map((m) => [m.id, m]));

  return (
    <AppShell activePath="/settings" userEmail={user.email}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-zinc-400">Manage your account and subscription</p>
        </div>

        {/* Account */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Account</h2>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Email</span>
            <span className="text-zinc-300">{user.email}</span>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Subscription</h2>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Status</span>
            <span className={STATUS_COLOR[status] ?? "text-zinc-400"}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          {sub?.currentPeriodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">
                {status === "trialing" ? "Trial ends" : status === "canceled" ? "Access until" : "Next billing"}
              </span>
              <span className="text-zinc-300">
                {sub.currentPeriodEnd.toLocaleDateString("en-AU", {
                  timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
          )}
          <div className="pt-1">
            {sub?.stripeCustomerId ? (
              <ManageBillingButton />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">No active subscription. Start your free trial to unlock all features.</p>
                <CheckoutButton priceId={monthlyPriceId} label="Start 7-Day Free Trial" />
              </div>
            )}
          </div>
        </div>

        {/* Push notifications */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Push Notifications</h2>
          <PushToggle />
        </div>

        {/* Alert preferences */}
        <form action={saveAlertPrefs}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-5">
            <h2 className="text-sm font-medium text-zinc-300">Alert Preferences</h2>

            {/* Contact */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Email for alerts</label>
                <input type="email" name="email" title="Email for alerts"
                  defaultValue={alertPrefs?.email ?? user.email ?? ""}
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Phone for SMS (optional, e.g. +61412345678)</label>
                <input type="tel" name="phone" title="Phone for SMS alerts"
                  defaultValue={alertPrefs?.phone ?? ""}
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-800 pt-4">

              {/* Arb alerts */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <input type="checkbox" name="alertNewArb" defaultChecked={alertPrefs?.alertNewArb ?? true}
                      className="rounded border-zinc-700 bg-zinc-900 accent-green-500" />
                    Arbitrage alerts
                  </label>
                  <p className="mt-0.5 pl-6 text-xs text-zinc-500">Get notified when a new arb is detected</p>
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-zinc-500 mb-1 text-right">Min ROI %</label>
                  <input type="number" name="minArbRoi" title="Minimum arb ROI %" step="0.1" min="0" max="20"
                    defaultValue={Number(alertPrefs?.minArbRoi ?? 0.5)}
                    className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 text-right outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>

              {/* Steam alerts */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <input type="checkbox" name="alertSteamMove" defaultChecked={alertPrefs?.alertSteamMove ?? true}
                      className="rounded border-zinc-700 bg-zinc-900 accent-green-500" />
                    Steam move alerts
                  </label>
                  <p className="mt-0.5 pl-6 text-xs text-zinc-500">Price shifts ≥ threshold % in a single poll cycle</p>
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-zinc-500 mb-1 text-right">Threshold %</label>
                  <input type="number" name="steamMoveThreshold" title="Steam move threshold %" step="1" min="1" max="50"
                    defaultValue={Number(alertPrefs?.steamMoveThreshold ?? 10)}
                    className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 text-right outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>

              {/* EV alerts */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <input type="checkbox" name="alertHighEv" defaultChecked={alertPrefs?.alertHighEv ?? false}
                      className="rounded border-zinc-700 bg-zinc-900 accent-green-500" />
                    High EV alerts
                  </label>
                  <p className="mt-0.5 pl-6 text-xs text-zinc-500">Notified when a bet exceeds the EV threshold</p>
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-zinc-500 mb-1 text-right">Min EV %</label>
                  <input type="number" name="minEvPercent" title="Minimum EV %" step="0.5" min="0" max="20"
                    defaultValue={Number(alertPrefs?.minEvPercent ?? 3)}
                    className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 text-right outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>

              {/* Hot bets alerts */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <input type="checkbox" name="alertHotBets" defaultChecked={alertPrefs?.alertHotBets ?? false}
                      className="rounded border-zinc-700 bg-zinc-900 accent-green-500" />
                    Hot bet alerts
                  </label>
                  <p className="mt-0.5 pl-6 text-xs text-zinc-500">Large, rapid price moves across multiple books</p>
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-zinc-500 mb-1 text-right">Move %</label>
                  <input type="number" name="hotBetsThreshold" title="Hot bet move threshold %" step="1" min="1" max="50"
                    defaultValue={Number(alertPrefs?.hotBetsThreshold ?? 15)}
                    className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 text-right outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>

              {/* Daily digest */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                    <input type="checkbox" name="alertDailyDigest" defaultChecked={alertPrefs?.alertDailyDigest ?? false}
                      className="rounded border-zinc-700 bg-zinc-900 accent-green-500" />
                    Daily best value digest
                  </label>
                  <p className="mt-0.5 pl-6 text-xs text-zinc-500">Top EV bet of the day delivered each morning</p>
                </div>
                <div className="shrink-0">
                  <label className="block text-xs text-zinc-500 mb-1 text-right">Send at (AEST)</label>
                  <input type="time" name="digestTime" title="Daily digest send time"
                    defaultValue={alertPrefs?.digestTime ?? "09:00"}
                    className="w-24 rounded-lg bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 text-right outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>
            </div>

            <button type="submit"
              className="w-full rounded-lg bg-zinc-800 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700">
              Save alert preferences
            </button>
          </div>
        </form>

        {/* Match-specific alerts */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">Match Alerts</h2>
            <p className="mt-1 text-xs text-zinc-500">Get notified about specific upcoming games</p>
          </div>

          <form action={addMatchAlert} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <select name="matchId" title="Select match" required
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600">
              <option value="">Select match…</option>
              {upcomingMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.homeTeam} vs {m.awayTeam} · {m.kickoffAt.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </option>
              ))}
            </select>
            <select name="alertType" title="Select alert type" required
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600">
              <option value="best_odds">Best odds change</option>
              <option value="line_move">Line move</option>
              <option value="arb">Arbitrage</option>
            </select>
            <button type="submit"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-600">
              Add
            </button>
          </form>

          {matchAlerts.length === 0 ? (
            <p className="text-xs text-zinc-600">No match alerts set.</p>
          ) : (
            <div className="space-y-2">
              {matchAlerts.map((a) => {
                const match = matchMap.get(a.matchId);
                const deleteAction = deleteMatchAlert.bind(null, a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 p-3 text-sm">
                    <div>
                      <p className="text-zinc-200">
                        {match ? `${match.homeTeam} vs ${match.awayTeam}` : "Match ended"}
                      </p>
                      <p className="text-xs text-zinc-500">{ALERT_TYPE_LABEL[a.alertType] ?? a.alertType}</p>
                    </div>
                    <form action={deleteAction}>
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin link — only visible to admin */}
        {user.email === process.env.ADMIN_EMAIL && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-300">Admin</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Metrics, API keys, subscriber data</p>
            </div>
            <Link href="/admin"
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700">
              Open →
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
