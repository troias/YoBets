import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail, sendSms, sendPush } from "@/lib/alerts";

type OddsRow = { bookmaker: string; marketType: string; outcome: string | null; price: unknown };

// Called by a cron job (Railway cron or Vercel cron) once per minute.
// Only sends to users whose digestTime matches the current hour:minute (AEST).
// Secure with CRON_SECRET so only the cron caller can trigger it.

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Current time in AEST (UTC+10, no DST adjustment — close enough for a digest)
  const now = new Date();
  const aestOffset = 10 * 60;
  const aestMs = now.getTime() + aestOffset * 60_000;
  const aest = new Date(aestMs);
  const currentTime = `${String(aest.getUTCHours()).padStart(2, "0")}:${String(aest.getUTCMinutes()).padStart(2, "0")}`;

  // Find users who want a digest at this exact time
  const prefs = await prisma.alertPreferences.findMany({
    where: { alertDailyDigest: true, digestTime: currentTime },
  });
  if (prefs.length === 0) return NextResponse.json({ sent: 0 });

  // Find top EV bet from the last 24h of odds data
  const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);
  const upcomingMatches = await prisma.match.findMany({
    where: { status: "upcoming", kickoffAt: { gte: now } },
    include: { odds: true },
  });

  // No-vig EV: for each h2h market, de-vig across home+away to find fair prob,
  // then compare to offered odds to get EV%
  type EVCandidate = {
    matchName: string; bookmaker: string; outcome: string;
    offeredOdds: number; fairOdds: number; evPct: number;
  };

  const candidates: EVCandidate[] = [];

  for (const match of upcomingMatches) {
    const h2h = match.odds.filter((o: OddsRow) => o.marketType === "h2h");
    const bookmakers = [...new Set(h2h.map((o: OddsRow) => o.bookmaker))];

    for (const bk of bookmakers) {
      const bkOdds = h2h.filter((o: OddsRow) => o.bookmaker === bk);
      const homeOdds = bkOdds.find((o: OddsRow) => o.outcome === "home");
      const awayOdds = bkOdds.find((o: OddsRow) => o.outcome === "away");
      if (!homeOdds || !awayOdds) continue;

      const homeP = 1 / Number(homeOdds.price);
      const awayP = 1 / Number(awayOdds.price);
      const vig = homeP + awayP;
      const fairHome = homeP / vig;
      const fairAway = awayP / vig;

      const homeEv = (fairHome * Number(homeOdds.price) - 1) * 100;
      const awayEv = (fairAway * Number(awayOdds.price) - 1) * 100;

      const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
      if (homeEv > 0) candidates.push({ matchName, bookmaker: bk, outcome: "home", offeredOdds: Number(homeOdds.price), fairOdds: 1 / fairHome, evPct: homeEv });
      if (awayEv > 0) candidates.push({ matchName, bookmaker: bk, outcome: "away", offeredOdds: Number(awayOdds.price), fairOdds: 1 / fairAway, evPct: awayEv });
    }
  }

  if (candidates.length === 0) return NextResponse.json({ sent: 0, reason: "no EV bets found" });

  const top = candidates.sort((a, b) => b.evPct - a.evPct)[0];

  const subject = `EdgeBoard daily digest — best bet: ${top.matchName}`;
  const html = `
    <h2 style="color:#34d399">Best value bet today: +${top.evPct.toFixed(2)}% EV</h2>
    <p><strong>${top.matchName}</strong></p>
    <p>${top.bookmaker}: ${top.outcome} @ ${top.offeredOdds.toFixed(2)} (fair: ${top.fairOdds.toFixed(2)})</p>
    ${candidates.length > 1 ? `<p style="color:#888">${candidates.length - 1} other +EV bet${candidates.length > 2 ? "s" : ""} available — <a href="https://edgeboard.com.au/ev">view all →</a></p>` : ""}
    <hr/>
    <p style="color:#888;font-size:12px">Gamble responsibly. <a href="https://www.gamblinghelponline.org.au">gamblinghelponline.org.au</a></p>
  `;
  const sms = `EdgeBoard daily: ${top.matchName} — ${top.outcome} @ ${top.offeredOdds.toFixed(2)} on ${top.bookmaker} (+${top.evPct.toFixed(2)}% EV). edgeboard.com.au/ev`;

  const userIds = prefs.map(p => p.userId);
  const pushSubs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const pushByUser = new Map<string, typeof pushSubs>();
  for (const sub of pushSubs) {
    if (!pushByUser.has(sub.userId)) pushByUser.set(sub.userId, []);
    pushByUser.get(sub.userId)!.push(sub);
  }

  let sent = 0;
  for (const pref of prefs) {
    if (pref.email) { await sendEmail(pref.email, subject, html).catch(() => {}); sent++; }
    if (pref.phone) { await sendSms(pref.phone, sms).catch(() => {}); }
    const subs = pushByUser.get(pref.userId) ?? [];
    if (subs.length) await sendPush(subs, "EdgeBoard daily digest", sms, "/ev").catch(() => {});
  }

  return NextResponse.json({ sent, top });
}
