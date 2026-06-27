import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppConfig } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { createApiKey, deleteApiKey, upsertAppConfig, deleteAppConfig } from "@/app/actions/api-keys";
import { ConfigValue } from "@/components/config-value";

const SERVICES = [
  { group: "The Odds API", entries: [{ label: "The Odds API Key", key: "THE_ODDS_API_KEY" }] },
  { group: "Resend",       entries: [{ label: "Resend API Key",   key: "RESEND_API_KEY" }] },
  { group: "Twilio",       entries: [
    { label: "Account SID",  key: "TWILIO_ACCOUNT_SID" },
    { label: "Auth Token",   key: "TWILIO_AUTH_TOKEN" },
    { label: "Phone Number", key: "TWILIO_PHONE_NUMBER" },
  ]},
  { group: "Stripe", entries: [
    { label: "Secret Key",       key: "STRIPE_SECRET_KEY" },
    { label: "Publishable Key",  key: "STRIPE_PUBLISHABLE_KEY" },
    { label: "Webhook Secret",   key: "STRIPE_WEBHOOK_SECRET" },
    { label: "Monthly Price ID", key: "STRIPE_PRICE_MONTHLY" },
  ]},
] as const;

const KNOWN_KEYS = new Set<string>(SERVICES.flatMap((s) => s.entries.map((e) => e.key as string)));

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [active, trialing, churned, betAgg, wins, settled, apiKeys, appConfigs] = await Promise.all([
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.subscription.count({ where: { status: "canceled", updatedAt: { gte: thirtyDaysAgo } } }),
    prisma.betLog.aggregate({ _count: { id: true }, _sum: { profit: true } }),
    prisma.betLog.count({ where: { result: "won" } }),
    prisma.betLog.count({ where: { result: { in: ["won", "lost"] } } }),
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.appConfig.findMany({ orderBy: { label: "asc" } }),
  ]);

  const priceMonthly = parseFloat(process.env.SUBSCRIPTION_PRICE_AUD ?? "0");
  const mrr = priceMonthly > 0 ? active * priceMonthly : null;
  const winRate = settled > 0 ? ((wins / settled) * 100).toFixed(1) : null;
  const totalPl = Number(betAgg._sum.profit ?? 0);
  const configMap = new Map(appConfigs.map((c: AppConfig) => [c.key, c]));
  const customConfigs = appConfigs.filter((c: AppConfig) => !KNOWN_KEYS.has(c.key));

  const statCards = [
    { label: "Active",        value: active },
    { label: "Trialing",      value: trialing },
    { label: "Total subs",    value: active + trialing },
    { label: "Churned (30d)", value: churned },
  ];

  return (
    <AppShell activePath="/admin" userEmail={user.email}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-zinc-400">Platform metrics and API access</p>
        </div>

        {/* Subscriber cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {/* MRR */}
        {mrr !== null ? (
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/90 p-5">
            <div>
              <p className="text-xs text-zinc-500">Estimated MRR</p>
              <p className="mt-1 text-2xl font-semibold text-green-400">${mrr.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">ARR</p>
              <p className="mt-1 text-lg font-medium text-zinc-300">${(mrr * 12).toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">
            Set <code>SUBSCRIPTION_PRICE_AUD</code> in .env.local to show MRR.
          </p>
        )}

        {/* Bet tracker */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Bet Tracker (all users)</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Total bets</p>
              <p className="font-medium text-zinc-200">{betAgg._count.id}</p>
            </div>
            <div>
              <p className="text-zinc-500">Win rate</p>
              <p className="font-medium text-zinc-200">{winRate ? `${winRate}%` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Total P&L</p>
              <p className={`font-medium ${totalPl >= 0 ? "text-green-400" : "text-red-400"}`}>
                ${totalPl.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* App Config */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-6">
          <h2 className="text-sm font-medium text-zinc-300">App Config</h2>

          {SERVICES.map(({ group, entries }) => (
            <div key={group}>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">{group}</p>
              <div className="space-y-2">
                {entries.map(({ label, key }) => {
                  const existing = configMap.get(key);
                  const envValue = process.env[key] ?? null;
                  const displayValue = existing?.value ?? envValue;
                  const source = existing ? "db" : envValue ? "env" : null;
                  const deleteAction = existing ? deleteAppConfig.bind(null, existing.id) : null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <p className="text-sm text-zinc-300">{label}</p>
                        <p className="font-mono text-[10px] text-zinc-600">{key}</p>
                      </div>
                      {displayValue ? (
                        <div className="flex flex-1 items-center gap-2">
                          <ConfigValue value={displayValue} />
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            source === "db" ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
                          }`}>
                            {source}
                          </span>
                          {existing && deleteAction && (
                            <form action={deleteAction}>
                              <button type="submit" className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <form action={upsertAppConfig} className="flex flex-1 gap-2">
                          <input type="hidden" name="label" value={label} />
                          <input type="hidden" name="key" value={key} />
                          <input name="value" placeholder="Paste value…" required
                            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                          <button type="submit"
                            className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-600">
                            Save
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Custom entries */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Custom</p>
            {customConfigs.length > 0 && (
              <div className="mb-3 space-y-2">
                {customConfigs.map((c) => {
                  const deleteAction = deleteAppConfig.bind(null, c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <p className="text-sm text-zinc-300">{c.label}</p>
                        <p className="font-mono text-[10px] text-zinc-600">{c.key}</p>
                      </div>
                      <ConfigValue value={c.value} />
                      <form action={deleteAction}>
                        <button type="submit" className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
            <form action={upsertAppConfig} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <input name="label" placeholder="Label" required
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              <input name="key" placeholder="KEY_NAME" required
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              <input name="value" placeholder="Value" required
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              <button type="submit"
                className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-600">
                Save
              </button>
            </form>
          </div>
        </div>

        {/* API Keys */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">API Keys</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Pass as <code className="text-zinc-400">Authorization: Bearer &lt;key&gt;</code> to{" "}
              <code className="text-zinc-400">GET /api/metrics</code>
            </p>
          </div>

          <form action={createApiKey} className="flex gap-2">
            <input name="name" placeholder="Key name (e.g. Digital Income OS)" required
              className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
            <button type="submit"
              className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500">
              Generate
            </button>
          </form>

          {apiKeys.length === 0 ? (
            <p className="text-xs text-zinc-600">No keys yet.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => {
                const deleteAction = deleteApiKey.bind(null, k.id);
                return (
                  <div key={k.id} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-900 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{k.name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-zinc-400">{k.key}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Created {k.createdAt.toLocaleDateString("en-AU")}
                        {k.lastUsedAt && ` · Last used ${k.lastUsedAt.toLocaleDateString("en-AU")}`}
                      </p>
                    </div>
                    <form action={deleteAction}>
                      <button type="submit"
                        className="shrink-0 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-zinc-800">
                        Revoke
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
