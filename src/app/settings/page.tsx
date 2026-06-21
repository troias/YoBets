import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import { AppShell } from "@/components/layout/app-shell";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import prisma from "@/lib/prisma";

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

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const status = await getSubscriptionStatus(user.id);
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";

  return (
    <AppShell activePath="/settings" userEmail={user.email}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-zinc-400">Manage your account and subscription</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Account</h2>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Email</span>
            <span className="text-zinc-300">{user.email}</span>
          </div>
        </div>

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
                  timeZone: "Australia/Sydney",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          <div className="pt-1">
            {sub?.stripeCustomerId ? (
              <ManageBillingButton />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  No active subscription. Start your free trial to unlock all features.
                </p>
                <CheckoutButton priceId={monthlyPriceId} label="Start 7-Day Free Trial" />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
