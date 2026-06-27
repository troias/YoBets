import Link from "next/link";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus, isSubscribed } from "@/lib/subscription";
import { CheckoutButton } from "@/components/billing/checkout-button";
import prisma from "@/lib/prisma";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";

const PRODUCT_IDS = ["prod_UmPgHfxCcttzyp", "prod_UmPzL1Ez263ESU"];

const FREE_FEATURES = [
  "NRL odds board — 11 bookmakers side by side, best price highlighted",
  "My team — star any NRL team to pin it to the top of the board",
  "Arb finder — guaranteed profit when books disagree",
  "EV finder — no-vig fair pricing + Kelly stake calculator",
  "Line movement tracker — 1h to 48h windows",
  "Market Brief — daily digest of best plays",
  "Live markets — kicking off within 2 hours",
  "Bookmaker balance tracker — scale arb stakes to your available funds",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Price alerts — set a target price on any outcome; pushed to your phone the instant it hits",
  "EV alerts — notified the moment a +EV bet appears",
  "Steam move alerts — notified when sharp money shifts a line",
  "Arb alerts — notified the instant a profit window opens",
  "Game-day digest — 9am email with the best bets on NRL days",
  "Weekly performance summary — P&L, ROI and win rate after each round",
  "Closing Line Value (CLV) tracker — measure your edge against the closing price",
  "Bet ROI dashboard — log bets, track P&L and per-bookmaker breakdown",
  "Refer a friend — both get 2 extra weeks free",
  "7-day free trial — cancel anytime",
];

export default async function PricingPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const status = user ? await getSubscriptionStatus(user.id) : null;
  const subscribed = status ? isSubscribed(status) : false;

  // Fetch prices live from Stripe product — no hardcoded price IDs needed
  let monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
  let annualPriceId  = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL  ?? "";
  let monthlyAmount  = 19;
  let annualAmount   = 99;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);
      for (const productId of PRODUCT_IDS) {
        const prices = await stripe.prices.list({ product: productId, active: true });
        for (const price of prices.data) {
          const interval = price.recurring?.interval;
          const amount   = (price.unit_amount ?? 0) / 100;
          if (interval === "month") { monthlyPriceId = price.id; monthlyAmount = amount; }
          if (interval === "year")  { annualPriceId  = price.id; annualAmount  = amount; }
        }
      }
    } catch { /* Stripe not configured yet — fall back to env vars */ }
  }

  // Live urgency stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [upcomingMatches, weekAlertKeys, lastArbAlert] = await Promise.all([
    prisma.match.findMany({
      where: { kickoffAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) }, status: "upcoming" },
      include: { odds: { where: { marketType: "h2h", bookmaker: { notIn: ["bet365"] } } } },
      orderBy: { kickoffAt: "asc" },
    }),
    prisma.alertLog.findMany({
      where: { sentAt: { gte: weekAgo } },
      select: { alertType: true, key: true },
      distinct: ["alertType", "key"],
    }).catch(() => [] as { alertType: string; key: string }[]),
    prisma.alertLog.findFirst({
      where: { alertType: "arb" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true, key: true },
    }).catch(() => null),
  ]);

  // Count live arbs
  let liveArbCount = 0;
  for (const match of upcomingMatches) {
    type OddsRow = { bookmaker: string; outcome: string; price: unknown; deepLinkUrl: string; lineValue: unknown };
    const odds = match.odds as unknown as OddsRow[];
    const bestHome = odds.filter(o => o.outcome === "home").reduce((b: OddsRow | null, o) => !b || Number(o.price) > Number(b.price) ? o : b, null);
    const bestAway = odds.filter(o => o.outcome === "away").reduce((b: OddsRow | null, o) => !b || Number(o.price) > Number(b.price) ? o : b, null);
    if (bestHome && bestAway) {
      const result = detectTwoWayArbitrage([
        { sportsbook: bestHome.bookmaker, selection: "home", odds: Number(bestHome.price) },
        { sportsbook: bestAway.bookmaker, selection: "away", odds: Number(bestAway.price) },
      ]);
      if (result) liveArbCount++;
    }
  }

  // Count weekly alert opportunities
  const weeklyByType: Record<string, number> = {};
  for (const row of weekAlertKeys) {
    weeklyByType[row.alertType] = (weeklyByType[row.alertType] ?? 0) + 1;
  }
  const totalWeeklyAlerts = Object.values(weeklyByType).reduce((s, v) => s + v, 0);

  // Ghost notification example: parse last arb alert key
  let ghostAlertText: string | null = null;
  if (lastArbAlert) {
    const parts = lastArbAlert.key.split("|");
    const home = parts[2] ?? "";
    const away = parts[3] ?? "";
    const hoursAgo = Math.round((now.getTime() - lastArbAlert.sentAt.getTime()) / 3_600_000);
    const timeLabel = hoursAgo === 0 ? "just now" : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`;
    if (home && away) {
      ghostAlertText = `Arb alert — ${home} / ${away} · sent ${timeLabel}`;
    } else {
      ghostAlertText = `Arb opportunity detected · sent ${timeLabel}`;
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition">
          ← EdgeBoard
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Find an edge. Keep your winnings.
        </h1>
        <p className="mt-2 text-zinc-400 max-w-md mx-auto">
          Compare NRL odds across 11 bookmakers, find +EV bets, and get alerted the moment a price moves in your favour — push, email, or SMS.
        </p>
      </div>

      {/* Live urgency stats */}
      {(liveArbCount > 0 || totalWeeklyAlerts > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          {liveArbCount > 0 && (
            <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 px-4 py-3">
              <div className="text-2xl font-bold text-amber-400">{liveArbCount}</div>
              <div className="mt-0.5 text-xs text-zinc-500">arb{liveArbCount !== 1 ? "s" : ""} open now</div>
            </div>
          )}
          {weeklyByType.arb != null && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3">
              <div className="text-2xl font-bold text-zinc-100">{weeklyByType.arb}</div>
              <div className="mt-0.5 text-xs text-zinc-500">arb{weeklyByType.arb !== 1 ? "s" : ""} this week</div>
            </div>
          )}
          {weeklyByType.ev != null && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3">
              <div className="text-2xl font-bold text-zinc-100">{weeklyByType.ev}</div>
              <div className="mt-0.5 text-xs text-zinc-500">+EV bets this week</div>
            </div>
          )}
          {weeklyByType.steam != null && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3">
              <div className="text-2xl font-bold text-zinc-100">{weeklyByType.steam}</div>
              <div className="mt-0.5 text-xs text-zinc-500">steam moves this week</div>
            </div>
          )}
        </div>
      )}

      {/* Ghost notification example */}
      {ghostAlertText && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Example Pro alert</p>
          <div className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3">
            <span className="mt-0.5 text-lg">🔔</span>
            <div>
              <p className="text-sm font-medium text-zinc-100">{ghostAlertText}</p>
              <p className="mt-0.5 text-xs text-zinc-500">EdgeBoard · pushed to your phone instantly</p>
            </div>
          </div>
          <p className="text-xs text-zinc-600">These windows close in under 10 minutes. By the time you check manually, it&apos;s usually gone.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">

        {/* Free */}
        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="text-sm font-medium text-zinc-400">Free</div>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-bold">$0</span>
            <span className="mb-1 text-zinc-500">forever</span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">No credit card required</p>

          <ul className="mt-6 flex-1 space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 shrink-0 text-zinc-500">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {user ? (
              <Link
                href="/dashboard"
                className="block w-full rounded-lg bg-zinc-800 py-2.5 text-center text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/register"
                className="block w-full rounded-lg bg-zinc-800 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
              >
                Sign up free
              </Link>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-xl border border-amber-500/40 bg-zinc-950/90 p-6">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-semibold text-amber-400">
            Pro — 7-day free trial
          </div>
          <div className="text-sm font-medium text-amber-400">Pro</div>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-bold">${monthlyAmount > 0 ? monthlyAmount : 19}</span>
            <span className="mb-1 text-zinc-400">AUD / month</span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">or ${annualAmount > 0 ? annualAmount : 99}/year · Cancel anytime</p>
          <p className="mt-3 text-xs text-amber-400/80">Get notified before the edge disappears</p>

          <ul className="mt-4 flex-1 space-y-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 shrink-0 text-amber-500">✓</span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {subscribed ? (
              <Link
                href="/settings"
                className="block w-full rounded-lg bg-zinc-800 py-2.5 text-center text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                Manage subscription
              </Link>
            ) : user ? (
              <CheckoutButton priceId={monthlyPriceId} label="Start free trial →" variant="default" />
            ) : (
              <Link
                href="/register"
                className="block w-full rounded-lg bg-amber-500 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-amber-400"
              >
                Start free trial →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Annual upsell */}
      {!subscribed && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/90 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Annual plan — ${annualAmount > 0 ? annualAmount : 99} AUD / year</p>
            <p className="text-xs text-zinc-500 mt-0.5">${annualAmount > 0 ? (annualAmount / 12).toFixed(2) : "8.25"}/month · Same features · Save ${annualAmount > 0 ? ((monthlyAmount * 12) - annualAmount).toFixed(0) : "129"} vs monthly</p>
          </div>
          {user ? (
            <CheckoutButton priceId={annualPriceId} label="Get annual →" variant="secondary" />
          ) : (
            <Link href="/register" className="shrink-0 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700">
              Get annual →
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3 text-center">
        <p className="text-xs text-zinc-600">
          All prices in Australian dollars (AUD) · GST included · Billed via Stripe · Cancel anytime from settings
        </p>
        <p className="text-xs text-zinc-700">
          Odds move fast. Pro users are notified the second a price, line, or arb crosses their threshold.
        </p>
      </div>
    </div>
  );
}
