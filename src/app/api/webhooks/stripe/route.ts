import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

// Stripe v22 types are strict — we use loose shapes for webhook event objects
// since we've already verified the signature before touching the data.
type StripeSubscription = {
  id: string;
  status: string;
  current_period_end: number;
  metadata?: Record<string, string>;
};

type StripeInvoice = {
  subscription?: string | null;
};

type StripeCheckoutSession = {
  customer: string;
  subscription?: string | null;
  metadata?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const userId = session.metadata?.supabaseUserId;
        if (!userId || !session.subscription) break;

        const sub = await stripe.subscriptions.retrieve(session.subscription) as unknown as StripeSubscription;
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
          update: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as unknown as StripeSubscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "canceled" },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as StripeInvoice;
        if (!invoice.subscription) break;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: { status: "past_due" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
