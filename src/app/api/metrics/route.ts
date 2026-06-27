import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { key } });
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [active, trialing, churned, betAgg, wins, settled] = await Promise.all([
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.subscription.count({ where: { status: "canceled", updatedAt: { gte: thirtyDaysAgo } } }),
    prisma.betLog.aggregate({ _count: { id: true }, _sum: { profit: true } }),
    prisma.betLog.count({ where: { result: "won" } }),
    prisma.betLog.count({ where: { result: { in: ["won", "lost"] } } }),
  ]);

  const priceMonthly = parseFloat(process.env.SUBSCRIPTION_PRICE_AUD ?? "0");
  const mrr = priceMonthly > 0 ? active * priceMonthly : null;

  return NextResponse.json({
    subscribers: {
      active,
      trialing,
      total: active + trialing,
    },
    mrr,
    arr: mrr !== null ? mrr * 12 : null,
    churn_30d: churned,
    bets: {
      total: betAgg._count.id,
      win_rate: settled > 0 ? wins / settled : null,
      total_pl: Number(betAgg._sum.profit ?? 0),
    },
    generated_at: new Date().toISOString(),
  });
}
