import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/alerts";

export const maxDuration = 60;

// Cron endpoint for Monday 9am AEST weekly performance summary.
// Called by Railway/Vercel cron at 23:00 UTC Sunday (= 09:00 AEST Monday).
// Sends to Pro users with settled bets in the last 7 days.

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.au";

  // Get all Pro subscribers
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["active", "trialing"] } },
    select: { userId: true },
  });

  let sent = 0;
  for (const sub of subs) {
    const bets = await prisma.betLog.findMany({
      where: { userId: sub.userId, settledAt: { gte: weekAgo }, result: { not: null as unknown as string } },
    });

    if (bets.length === 0) continue;

    const totalBets    = bets.length;
    const wins         = bets.filter(b => b.result === "win").length;
    const losses       = bets.filter(b => b.result === "loss").length;
    const totalStaked  = bets.reduce((s, b) => s + Number(b.stake), 0);
    const totalProfit  = bets.reduce((s, b) => s + Number(b.profit ?? 0), 0);
    const roi          = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const winRate      = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Per-bookmaker breakdown
    const byBook = new Map<string, { bets: number; profit: number }>();
    for (const b of bets) {
      const existing = byBook.get(b.bookmaker) ?? { bets: 0, profit: 0 };
      byBook.set(b.bookmaker, { bets: existing.bets + 1, profit: existing.profit + Number(b.profit ?? 0) });
    }
    const bookRows = [...byBook.entries()].sort((a, b) => b[1].profit - a[1].profit);

    const profitColour = totalProfit >= 0 ? "#4ade80" : "#f87171";
    const roiColour    = roi >= 0 ? "#4ade80" : "#f87171";

    const bookHtml = bookRows.map(([bm, s]) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #27272a;color:#a1a1aa">${bm}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #27272a;text-align:right">${s.bets}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #27272a;text-align:right;color:${s.profit >= 0 ? "#4ade80" : "#f87171"}">
          ${s.profit >= 0 ? "+" : ""}$${Math.abs(s.profit).toFixed(2)}
        </td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto">
  <p style="color:#71717a;font-size:13px;margin-bottom:8px">EdgeBoard · Weekly Summary</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px">Your week in bets</h1>

  <!-- Stats row -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:700;color:${profitColour}">${totalProfit >= 0 ? "+" : ""}$${Math.abs(totalProfit).toFixed(2)}</div>
      <div style="font-size:11px;color:#71717a;margin-top:2px">P&amp;L</div>
    </div>
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:700;color:${roiColour}">${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%</div>
      <div style="font-size:11px;color:#71717a;margin-top:2px">ROI</div>
    </div>
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:700">${wins}/${totalBets}</div>
      <div style="font-size:11px;color:#71717a;margin-top:2px">${winRate.toFixed(0)}% win rate</div>
    </div>
  </div>

  ${bookRows.length > 1 ? `
  <h2 style="font-size:14px;font-weight:600;margin:0 0 10px">By bookmaker</h2>
  <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:8px;overflow:hidden;margin-bottom:24px">
    <thead>
      <tr style="background:#27272a">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:500">Book</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#71717a;font-weight:500">Bets</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#71717a;font-weight:500">P&L</th>
      </tr>
    </thead>
    <tbody>${bookHtml}</tbody>
  </table>
  ` : ""}

  <div style="text-align:center;margin-bottom:32px">
    <a href="${siteUrl}/bets" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">
      View full bet history →
    </a>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
  <p style="font-size:11px;color:#3f3f46;text-align:center">
    Gamble responsibly. <a href="https://www.gamblinghelponline.org.au" style="color:#52525b">Gambling Help Online 1800 858 858</a>.
    <br/><a href="${siteUrl}/settings" style="color:#52525b">Manage email preferences →</a>
  </p>
</div>
</body>
</html>`;

    // Get user email from Supabase auth table
    const userRows = await prisma.$queryRaw<{ email: string }[]>`
      SELECT email FROM auth.users WHERE id::text = ${sub.userId} LIMIT 1
    `.catch(() => [] as { email: string }[]);

    const email = userRows[0]?.email;
    if (!email) continue;

    const pnlLabel = totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`;
    await sendEmail(email, `EdgeBoard: your week — ${pnlLabel} from ${totalBets} bet${totalBets !== 1 ? "s" : ""}`, html).catch(() => {});
    sent++;
  }

  return NextResponse.json({ sent });
}
