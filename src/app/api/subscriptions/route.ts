import { NextRequest, NextResponse } from "next/server";

const tiers = ["FREE", "PRO", "ENTERPRISE"] as const;

export async function GET() {
  return NextResponse.json({
    data: tiers.map((tier) => ({
      tier,
      monthlyPriceAud: tier === "FREE" ? 0 : tier === "PRO" ? 59 : 299,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({
    data: {
      userId: body.userId,
      tier: body.tier,
      status: "pending_checkout",
      provider: "stripe_placeholder",
    },
  });
}
