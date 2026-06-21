import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus, isSubscribed } from "@/lib/subscription";
import { CheckoutButton } from "@/components/billing/checkout-button";

const FEATURES = [
  "Live NRL odds across 11 Australian bookmakers",
  "H2H, Line, and Total markets",
  "Arb finder with exact stake splits",
  "EV finder with no-vig consensus line",
  "Best odds highlighted with direct bet links",
  "Updates every 2 minutes",
];

export default async function PricingPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const status = user ? await getSubscriptionStatus(user.id) : null;
  const subscribed = status ? isSubscribed(status) : false;

  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
  const annualPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition">
          ← EdgeBoard
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-2 text-zinc-400">
          One plan. Full access. Cancel anytime.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Monthly */}
        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="text-sm text-zinc-500">Monthly</div>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-bold">$12</span>
            <span className="mb-1 text-zinc-400">AUD / month</span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Billed monthly · Cancel anytime</p>

          <ul className="mt-6 flex-1 space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 text-green-500">✓</span>
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
              <CheckoutButton priceId={monthlyPriceId} />
            ) : (
              <Link
                href="/register"
                className="block w-full rounded-lg bg-white py-2.5 text-center text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Start 7-Day Free Trial
              </Link>
            )}
          </div>
        </div>

        {/* Annual */}
        <div className="relative flex flex-col rounded-xl border border-zinc-700 bg-zinc-950/90 p-6">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500/10 px-3 py-0.5 text-xs font-medium text-green-400">
            Save 31%
          </div>
          <div className="text-sm text-zinc-500">Annual</div>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-bold">$99</span>
            <span className="mb-1 text-zinc-400">AUD / year</span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">$8.25/month · Billed annually</p>

          <ul className="mt-6 flex-1 space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 text-green-500">✓</span>
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
              <CheckoutButton priceId={annualPriceId} label="Start 7-Day Free Trial" variant="default" />
            ) : (
              <Link
                href="/register"
                className="block w-full rounded-lg bg-white py-2.5 text-center text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Start 7-Day Free Trial
              </Link>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-600">
        All prices in Australian dollars (AUD) · GST included · 7-day free trial on all plans
      </p>
    </div>
  );
}
