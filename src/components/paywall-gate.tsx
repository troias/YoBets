import { Lock } from "lucide-react";
import { getSubscriptionStatus, isSubscribed, isAdminEmail } from "@/lib/subscription";
import { CheckoutButton } from "@/components/billing/checkout-button";

export async function PaywallGate({
  userId,
  userEmail,
  children,
}: {
  userId: string;
  userEmail?: string;
  children: React.ReactNode;
}) {
  if (isAdminEmail(userEmail)) return <>{children}</>;

  const status = await getSubscriptionStatus(userId);

  if (isSubscribed(status)) return <>{children}</>;

  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/90 py-20 text-center">
      <Lock className="mb-4 h-8 w-8 text-zinc-600" />
      <h2 className="text-lg font-semibold">Start your free trial</h2>
      <p className="mt-1 text-sm text-zinc-400">
        7 days free · then $12 AUD/month
      </p>
      <p className="mt-0.5 text-xs text-zinc-600">
        Full access to odds board, arb finder, and EV finder
      </p>
      <div className="mt-6">
        <CheckoutButton priceId={monthlyPriceId} />
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        No credit card required during trial · Cancel anytime
      </p>
    </div>
  );
}
