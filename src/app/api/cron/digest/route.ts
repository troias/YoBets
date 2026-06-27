import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/alerts";
import { getSubscriptionStatus, isSubscribed, isAdminEmail } from "@/lib/subscription";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";

export const maxDuration = 60;

// Cron endpoint for 9am AEST game-day digest.
// Called by Railway/Vercel cron at 23:00 UTC daily (= 09:00 AEST UTC+10).
// Only sends when there are NRL games today.

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const AEST_OFFSET = 10 * 3600 * 1000;
  const todayAest = new Date(now.getTime() + AEST_OFFSET);
  const todayStart = new Date(Date.UTC(todayAest.getUTCFullYear(), todayAest.getUTCMonth(), todayAest.getUTCDate()) - AEST_OFFSET);
  const todayEnd   = new Date(todayStart.getTime() + 86_400_000);

  // Check if there are games today
  const todayGames = await prisma.match.findMany({
    where: { kickoffAt: { gte: todayStart, lte: todayEnd } },
    include: { odds: { where: { marketType: "h2h", bookmaker: { notIn: ["bet365"] } } } },
    orderBy: { kickoffAt: "asc" },
  });

  if (todayGames.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no games today" });
  }

  // Find best EV bets across today's games
  type EVBet = { matchName: string; kickoffAt: Date; bookmaker: string; outcome: string; offeredOdds: number; fairOdds: number; evPct: number };
  const evBets: EVBet[] = [];
  let liveArbCount = 0;

  for (const match of todayGames) {
    type OddsRow = { bookmaker: string; outcome: string | null; price: unknown; deepLinkUrl: string };
    const odds = match.odds as unknown as OddsRow[];
    const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
    const homeOdds = odds.filter(o => o.outcome === "home");
    const awayOdds  = odds.filter(o => o.outcome === "away");

    // EV calculation per bookmaker
    const bookmakers = [...new Set(odds.map(o => o.bookmaker))];
    for (const bk of bookmakers) {
      const h = homeOdds.find(o => o.bookmaker === bk);
      const a = awayOdds.find(o => o.bookmaker === bk);
      if (!h || !a) continue;
      const hp = 1 / Number(h.price), ap = 1 / Number(a.price);
      const vig = hp + ap;
      const fairHome = hp / vig, fairAway = ap / vig;
      const homeEv = (fairHome * Number(h.price) - 1) * 100;
      const awayEv = (fairAway * Number(a.price) - 1) * 100;
      if (homeEv > 0) evBets.push({ matchName, kickoffAt: match.kickoffAt, bookmaker: bk, outcome: match.homeTeam.split(" ").slice(-1)[0], offeredOdds: Number(h.price), fairOdds: 1 / fairHome, evPct: homeEv });
      if (awayEv > 0) evBets.push({ matchName, kickoffAt: match.kickoffAt, bookmaker: bk, outcome: match.awayTeam.split(" ").slice(-1)[0], offeredOdds: Number(a.price), fairOdds: 1 / fairAway, evPct: awayEv });
    }

    // Arb check
    const bestHome = homeOdds.reduce((b, o) => !b || Number(o.price) > Number(b.price) ? o : b, null as OddsRow | null);
    const bestAway  = awayOdds.reduce((b, o) => !b || Number(o.price) > Number(b.price) ? o : b, null as OddsRow | null);
    if (bestHome && bestAway) {
      const arb = detectTwoWayArbitrage([
        { sportsbook: bestHome.bookmaker, selection: "home", odds: Number(bestHome.price) },
        { sportsbook: bestAway.bookmaker, selection: "away", odds: Number(bestAway.price) },
      ]);
      if (arb) liveArbCount++;
    }
  }

  evBets.sort((a, b) => b.evPct - a.evPct);
  const top5 = evBets.slice(0, 5);

  if (top5.length === 0 && liveArbCount === 0) {
    return NextResponse.json({ skipped: true, reason: "no EV bets or arbs found" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://edgeboard.au";
  const dateLabel = todayAest.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Sydney" });

  const betsHtml = top5.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a">${b.matchName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#a1a1aa">${b.bookmaker}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a">${b.outcome} @ ${b.offeredOdds.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#fbbf24;font-weight:600">+${b.evPct.toFixed(2)}%</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
<div style="max-width:540px;margin:0 auto">
  <p style="color:#71717a;font-size:13px;margin-bottom:8px">EdgeBoard · Game Day Digest</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 4px">${dateLabel} — NRL day</h1>
  <p style="color:#71717a;font-size:13px;margin:0 0 24px">${todayGames.length} game${todayGames.length !== 1 ? "s" : ""} today${liveArbCount > 0 ? ` · ${liveArbCount} arb${liveArbCount !== 1 ? "s" : ""} open` : ""}</p>

  ${top5.length > 0 ? `
  <h2 style="font-size:15px;font-weight:600;color:#f4f4f5;margin:0 0 12px">Best +EV bets right now</h2>
  <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:8px;overflow:hidden;margin-bottom:24px">
    <thead>
      <tr style="background:#27272a">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:500">Match</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:500">Book</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:500">Selection</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#71717a;font-weight:500">EV</th>
      </tr>
    </thead>
    <tbody>${betsHtml}</tbody>
  </table>
  ` : ""}

  ${liveArbCount > 0 ? `
  <div style="background:#1c1400;border:1px solid #78350f;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0;font-size:14px;font-weight:600;color:#fbbf24">${liveArbCount} guaranteed profit arb${liveArbCount !== 1 ? "s" : ""} open now</p>
    <p style="margin:4px 0 0;font-size:12px;color:#a16207">These windows close fast — check now before they're gone.</p>
  </div>
  ` : ""}

  <div style="text-align:center;margin-bottom:32px">
    <a href="${siteUrl}/ev" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">
      View all bets on EdgeBoard →
    </a>
  </div>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
  <p style="font-size:11px;color:#3f3f46;text-align:center">
    EdgeBoard earns a commission on bookmaker sign-ups. Gamble responsibly.
    <a href="https://www.gamblinghelponline.org.au" style="color:#52525b">Gambling Help Online 1800 858 858</a>.
    <br/><a href="${siteUrl}/settings" style="color:#52525b">Manage digest preferences →</a>
  </p>
</div>
</body>
</html>`;

  // Get all subscribed users with email preferences
  const allUsers = await prisma.subscription.findMany({
    where: { status: { in: ["active", "trialing"] } },
    select: { userId: true },
  });
  const userIds = allUsers.map(u => u.userId);

  const prefs = await prisma.alertPreferences.findMany({
    where: { userId: { in: userIds }, alertDailyDigest: true },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const emailsToSend: string[] = [];

  for (const pref of prefs) {
    const up = await prisma.$queryRaw<{ email: string }[]>`
      SELECT email FROM auth.users WHERE id::text = ${pref.userId} LIMIT 1
    `.catch(() => [] as { email: string }[]);
    if (up[0]?.email) emailsToSend.push(up[0].email);
  }

  // Always send to admin regardless of pref
  if (adminEmail && !emailsToSend.includes(adminEmail)) emailsToSend.push(adminEmail);

  let sent = 0;
  for (const email of emailsToSend) {
    await sendEmail(email, `EdgeBoard: ${todayGames.length} NRL games today — ${top5.length > 0 ? `best bet +${top5[0].evPct.toFixed(1)}% EV` : `${liveArbCount} arb${liveArbCount !== 1 ? "s" : ""} open`}`, html).catch(() => {});
    sent++;
  }

  return NextResponse.json({ sent, games: todayGames.length, evBets: top5.length, arbs: liveArbCount });
}
