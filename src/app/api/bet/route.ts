import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus, isSubscribed, isAdminEmail } from "@/lib/subscription";
import prisma from "@/lib/prisma";

// Generic fallback deep links (same as the scraper constants)
const FALLBACK_LINKS: Record<string, string> = {
  sportsbet: "https://www.sportsbet.com.au/betting/rugby-league",
  tab:       "https://www.tab.com.au/sports/betting/Rugby%20League",
  ladbrokes: "https://www.ladbrokes.com.au/sports/rugby-league",
  neds:      "https://www.neds.com.au/sports/rugby-league",
  pointsbet: "https://pointsbet.com.au/sports/rugby-league",
  unibet:    "https://www.unibet.com.au/betting/sports/rugby-league",
  betright:  "https://betright.com.au/sports/rugby-league",
  betr:      "https://betr.com.au/sports/rugby-league",
  betfair:   "https://www.betfair.com.au/exchange/plus/rugby-league",
  tabtouch:  "https://www.tabtouch.com.au/sports/rugby-league",
  playup:    "https://www.playup.com.au/sports/rugby-league",
};

const BM_LABEL: Record<string, string> = {
  sportsbet: "Sportsbet", tab: "TAB", ladbrokes: "Ladbrokes", neds: "Neds",
  pointsbet: "PointsBet", unibet: "Unibet", betright: "BetRight", betr: "Betr",
  betfair: "Betfair", tabtouch: "TABtouch", playup: "PlayUp", bet365: "Bet365",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const bm = searchParams.get("bm") ?? "";

  // Resolve destination: affiliate link from DB → fallback deep link → homepage
  const [affConfig, cookieStore] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: `affiliate_${bm}` } }).catch(() => null),
    cookies(),
  ]);
  const dest = affConfig?.value || FALLBACK_LINKS[bm] || "https://www.sportsbet.com.au";

  // Increment click counter (fire-and-forget)
  if (bm) {
    const clickKey = `clicks_${bm}`;
    void (async () => {
      try {
        const existing = await prisma.appConfig.findUnique({ where: { key: clickKey } });
        const next = String((Number(existing?.value) || 0) + 1);
        await prisma.appConfig.upsert({
          where: { key: clickKey },
          create: { key: clickKey, label: `${bm} clicks`, value: next, updatedAt: new Date() },
          update: { value: next, updatedAt: new Date() },
        });
      } catch { /* ignore */ }
    })();
  }

  // Check subscription — Pro users skip the interstitial
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const subStatus = user ? await getSubscriptionStatus(user.id) : null;
  const isPro = subStatus ? isSubscribed(subStatus) : false;
  const isAdmin = isAdminEmail(user?.email);

  if (isPro || isAdmin) {
    return NextResponse.redirect(dest, { status: 302 });
  }

  // Interstitial for free/logged-out users — 2.5s auto-redirect with upgrade pitch
  const bmLabel = BM_LABEL[bm] ?? bm;
  const isLoggedIn = Boolean(user);
  const ctaHref  = isLoggedIn ? "/pricing" : "/register";
  const ctaLabel = isLoggedIn ? "Start free trial →" : "Create free account →";
  const pitch    = isLoggedIn
    ? "Pro sends a push notification the instant the next arb or +EV bet appears — before the window closes."
    : "Create a free EdgeBoard account to track your bets and get alerted when the next opportunity opens.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Redirecting to ${bmLabel}…</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:400px;width:100%;text-align:center;space-y:24px}
  .logo{font-size:18px;font-weight:600;color:#f4f4f5;margin-bottom:32px}
  .bm{font-size:22px;font-weight:600;color:#f4f4f5;margin-bottom:8px}
  .sub{font-size:13px;color:#71717a;margin-bottom:28px}
  .bar-wrap{background:#27272a;border-radius:4px;height:3px;overflow:hidden;margin-bottom:28px}
  .bar{height:3px;background:#f59e0b;border-radius:4px;animation:fill 2.5s linear forwards}
  @keyframes fill{from{width:0}to{width:100%}}
  .pitch{background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin-bottom:20px}
  .pitch-title{font-size:13px;font-weight:600;color:#fbbf24;margin-bottom:6px}
  .pitch-body{font-size:12px;color:#a1a1aa;line-height:1.5}
  .cta{display:inline-block;background:#f59e0b;color:#000;font-size:13px;font-weight:700;padding:10px 22px;border-radius:8px;text-decoration:none;margin-bottom:14px}
  .skip{font-size:12px;color:#52525b;text-decoration:none}
  .skip:hover{color:#a1a1aa}
</style>
</head>
<body>
<div class="card">
  <div class="logo">EdgeBoard</div>
  <div class="bm">Taking you to ${bmLabel}…</div>
  <div class="sub">Redirecting in 2.5 seconds</div>
  <div class="bar-wrap"><div class="bar"></div></div>
  <div class="pitch">
    <div class="pitch-title">Found this manually?</div>
    <div class="pitch-body">${pitch}</div>
  </div>
  <a href="${ctaHref}" class="cta">${ctaLabel}</a><br/>
  <a href="${dest}" class="skip">Skip — go to ${bmLabel} now →</a>
</div>
<script>setTimeout(()=>{window.location.href=${JSON.stringify(dest)}},2500)</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
