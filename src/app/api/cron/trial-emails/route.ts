import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/alerts";

export const maxDuration = 60;

// Cron endpoint for trial email sequence.
// Called daily at 23:00 UTC (09:00 AEST) — same time as digest cron.
// Sends Day 1/3/6 emails to users currently in trial based on trialStart date.

const SEQUENCE: Array<{ day: number; subject: string; headline: string; body: string; cta: string; ctaHref: string }> = [
  {
    day: 1,
    subject: "Welcome to EdgeBoard Pro — here's what to do first",
    headline: "You're in. Here's how to get the most from your trial.",
    body: `
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
        Your 7-day EdgeBoard Pro trial just started. Here's how to get value from day one:
      </p>
      <ol style="color:#a1a1aa;font-size:14px;line-height:1.8;margin:0 0 20px;padding-left:20px">
        <li><strong style="color:#f4f4f5">Enable push notifications</strong> — go to Settings and tap "Enable push alerts". This is how you'll hear about arbs before they close.</li>
        <li><strong style="color:#f4f4f5">Set a price alert</strong> — on the NRL board, tap the 🔔 bell on any outcome. You'll be pinged when the price hits your target.</li>
        <li><strong style="color:#f4f4f5">Log your first bet</strong> — track what you're betting at edgeboard.au/bets to see your ROI build over time.</li>
      </ol>
    `,
    cta: "Open EdgeBoard →",
    ctaHref: "/nrl",
  },
  {
    day: 3,
    subject: "EdgeBoard: 3 days in — your edge is working",
    headline: "3 days down. Here's what the data looks like.",
    body: `
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
        Most bettors miss edges because they check the boards too late. EdgeBoard sends you an alert the moment an arb opens or a +EV price appears — typically 5–15 minutes before the books correct it.
      </p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
        If you haven't already, set up push notifications. That's the one thing that separates Pro users who find arbs from the ones who see "0 open" every time they check.
      </p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 0">
        Questions? Reply to this email — it goes directly to the founder.
      </p>
    `,
    cta: "Set up push alerts →",
    ctaHref: "/settings",
  },
  {
    day: 6,
    subject: "EdgeBoard: 1 day left in your trial",
    headline: "Your trial ends tomorrow.",
    body: `
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
        Your 7-day Pro trial ends tomorrow. If you've found value — whether it's catching an arb, getting a price alert to fire, or just seeing your ROI clearly — keep it going for $19/month.
      </p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
        If you subscribe before midnight, you'll keep uninterrupted access to push alerts, EV notifications, and the bet tracker.
      </p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 0">
        No pressure. If it's not right for you, just let the trial expire — no charge. But if it is, we'd love to have you.
      </p>
    `,
    cta: "Continue Pro — $19/month →",
    ctaHref: "/pricing",
  },
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.au";
  const now = new Date();

  // Get all users currently trialing
  const trialSubs = await prisma.subscription.findMany({
    where: { status: "trialing" },
    select: { userId: true, createdAt: true },
  });

  let sent = 0;
  for (const sub of trialSubs) {
    const daysInTrial = Math.floor((now.getTime() - sub.createdAt.getTime()) / 86_400_000);

    for (const email of SEQUENCE) {
      if (daysInTrial < email.day) continue;

      const sentKey = `trial_email_${sub.userId}_day${email.day}`;
      const alreadySent = await prisma.appConfig.findUnique({ where: { key: sentKey } });
      if (alreadySent) continue;

      // Get user email
      const userRows = await prisma.$queryRaw<{ email: string }[]>`
        SELECT email FROM auth.users WHERE id::text = ${sub.userId} LIMIT 1
      `.catch(() => [] as { email: string }[]);
      const toEmail = userRows[0]?.email;
      if (!toEmail) continue;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto">
  <p style="color:#71717a;font-size:13px;margin-bottom:8px">EdgeBoard · Trial Day ${email.day}</p>
  <h1 style="font-size:20px;font-weight:600;margin:0 0 20px">${email.headline}</h1>
  ${email.body}
  <div style="text-align:center;margin:28px 0">
    <a href="${siteUrl}${email.ctaHref}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">
      ${email.cta}
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
  <p style="font-size:11px;color:#3f3f46;text-align:center">
    EdgeBoard · NRL odds comparison and alerts<br/>
    <a href="${siteUrl}/settings" style="color:#52525b">Manage email preferences →</a>
  </p>
</div>
</body>
</html>`;

      await sendEmail(toEmail, email.subject, html).catch(() => {});

      // Mark as sent
      await prisma.appConfig.create({
        data: { key: sentKey, label: `Trial email day ${email.day}`, value: now.toISOString(), updatedAt: now },
      }).catch(() => {});

      sent++;
    }
  }

  return NextResponse.json({ sent, trialing: trialSubs.length });
}
