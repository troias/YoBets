import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const bm = searchParams.get("bm") ?? "";

  // Resolve destination: affiliate link from DB → fallback deep link → homepage
  const affConfig = await prisma.appConfig
    .findUnique({ where: { key: `affiliate_${bm}` } })
    .catch(() => null);
  const dest = affConfig?.value || FALLBACK_LINKS[bm] || "https://www.sportsbet.com.au";

  // Increment click counter (fire-and-forget — don't block the redirect)
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

  return NextResponse.redirect(dest, { status: 302 });
}
