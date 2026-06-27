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

  // Soft gate: show content but with an upgrade nudge banner
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">Free plan</p>
          <p className="text-xs text-zinc-500">
            Go Pro for live 30-second polling, push alerts, and priority access · $19 AUD/month
          </p>
        </div>
        <div className="shrink-0">
          <CheckoutButton priceId={monthlyPriceId} label="Go Pro →" variant="secondary" />
        </div>
      </div>
      {children}
    </>
  );
}
