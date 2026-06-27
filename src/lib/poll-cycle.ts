import prisma from "@/lib/prisma";
import { TheOddsApiAdapter } from "@/workers/scrapers/adapters/the-odds-api";
import { Bet365Adapter } from "@/workers/scrapers/adapters/bet365";
import { OddsPortalAdapter } from "@/workers/scrapers/adapters/oddsportal";
import type { NrlOddsRow } from "@/workers/scrapers/adapters/the-odds-api";
import {
  sendEmail, sendSms, sendPush,
  arbAlertHtml, arbAlertSms, steamAlertHtml, steamAlertSms,
} from "@/lib/alerts";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";

const oddsApiAdapter    = new TheOddsApiAdapter();
const bet365Adapter     = new Bet365Adapter();
const oddsPortalAdapter = new OddsPortalAdapter();

// Caches persist across calls within the same process (good for the persistent worker,
// and fine for the API cron button since Next.js reuses module instances per-process).
const matchIdCache   = new Map<string, string>();
const matchFlipCache = new Map<string, boolean>();

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertPrefRow = {
  userId: string; email: string | null; phone: string | null;
  alertNewArb: boolean; minArbRoi: number | string;
  alertSteamMove: boolean; steamMoveThreshold: number | string;
  alertHighEv: boolean; minEvPercent: number | string;
  alertHotBets: boolean; hotBetsThreshold: number | string;
};
type PushSubRow    = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };
type AlertLogRow   = { id: string; userId: string; alertType: string; key: string; sentAt: Date };
type MatchAlertRow = { id: string; userId: string; matchId: string; alertType: string; threshold: number | string | null };
type EventSummary  = Pick<NrlOddsRow, "externalEventId" | "homeTeam" | "awayTeam" | "kickoffAt">;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEAM_ALIASES: Record<string, string> = {
  "cronulla sutherland sharks":  "Cronulla Sharks",
  "manly warringah sea eagles":  "Manly Sea Eagles",
  "nq cowboys":                  "North Queensland Cowboys",
  "st george illawarra dragons": "St. George Illawarra Dragons",
};

function normalizeTeam(name: string): string {
  return TEAM_ALIASES[name.toLowerCase()] ?? name;
}

function matchKey(home: string, away: string, date: string): string {
  return `${home}|${away}|${date}`;
}

function flipOutcome(outcome: string): string {
  if (outcome === "home") return "away";
  if (outcome === "away") return "home";
  return outcome;
}

function deduplicateEvents(rows: NrlOddsRow[]): EventSummary[] {
  const seen = new Map<string, EventSummary>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(awayTeam, homeTeam, date))
      ? matchKey(awayTeam, homeTeam, date)
      : matchKey(homeTeam, awayTeam, date);
    if (!seen.has(key)) {
      seen.set(key, { externalEventId: row.externalEventId, homeTeam, awayTeam, kickoffAt: row.kickoffAt });
    }
  }
  return [...seen.values()];
}

async function upsertMatches(events: EventSummary[]): Promise<void> {
  for (const event of events) {
    const date = event.kickoffAt.toISOString().slice(0, 10);
    const fwdKey = matchKey(event.homeTeam, event.awayTeam, date);
    const revKey = matchKey(event.awayTeam, event.homeTeam, date);
    if (matchIdCache.has(fwdKey) || matchIdCache.has(revKey)) continue;

    const dayStart = new Date(event.kickoffAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let match = await prisma.match.findFirst({
      where: {
        OR: [
          { homeTeam: { equals: event.homeTeam, mode: "insensitive" }, awayTeam: { equals: event.awayTeam, mode: "insensitive" } },
          { homeTeam: { equals: event.awayTeam, mode: "insensitive" }, awayTeam: { equals: event.homeTeam, mode: "insensitive" } },
        ],
        kickoffAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true, homeTeam: true },
    });

    let isFlipped = false;
    if (!match) {
      match = await prisma.match.create({
        data: {
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          kickoffAt: event.kickoffAt,
          round: 0,
          season: new Date().getFullYear(),
          status: "upcoming",
        },
        select: { id: true, homeTeam: true },
      });
    } else {
      isFlipped = match.homeTeam.toLowerCase() !== event.homeTeam.toLowerCase();
    }

    matchIdCache.set(fwdKey, match.id);
    matchIdCache.set(revKey, match.id);
    matchFlipCache.set(fwdKey, isFlipped);
    matchFlipCache.set(revKey, !isFlipped);
  }
}

async function upsertOdds(rows: NrlOddsRow[]): Promise<number> {
  const now = new Date();
  let count = 0;

  const byEvent = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date))
      ? matchKey(homeTeam, awayTeam, date)
      : matchKey(awayTeam, homeTeam, date);
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(row);
  }

  for (const [key, eventRows] of byEvent) {
    const matchId = matchIdCache.get(key);
    if (!matchId) continue;
    const isFlipped = matchFlipCache.get(key) ?? false;

    await prisma.$transaction(
      eventRows.map((row) => {
        const outcome = isFlipped ? flipOutcome(row.outcome) : row.outcome;
        return prisma.odds.upsert({
          where: { matchId_bookmaker_marketType_outcome: { matchId, bookmaker: row.bookmaker as any, marketType: row.marketType as any, outcome: outcome as any } },
          update:  { price: row.price, lineValue: row.lineValue ?? null, deepLinkUrl: row.deepLinkUrl, updatedAt: now },
          create:  { matchId, bookmaker: row.bookmaker as any, marketType: row.marketType as any, outcome: outcome as any, price: row.price, lineValue: row.lineValue ?? null, deepLinkUrl: row.deepLinkUrl, updatedAt: now },
        });
      }),
    );
    count += eventRows.length;
  }
  return count;
}

async function fetchCurrentPrices(): Promise<Map<string, number>> {
  const odds = await prisma.odds.findMany({
    select: { matchId: true, bookmaker: true, marketType: true, outcome: true, price: true },
  });
  const map = new Map<string, number>();
  for (const o of odds) {
    map.set(`${o.matchId}|${o.bookmaker}|${o.marketType}|${o.outcome}`, Number(o.price));
  }
  return map;
}

async function saveSnapshots(rows: NrlOddsRow[]): Promise<void> {
  const now = new Date();
  const inserts: Array<{ matchId: string; bookmaker: any; marketType: any; outcome: any; price: number; lineValue: number | null; recordedAt: Date }> = [];

  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date))
      ? matchKey(homeTeam, awayTeam, date)
      : matchKey(awayTeam, homeTeam, date);
    const matchId = matchIdCache.get(key);
    if (!matchId) continue;

    const isFlipped = matchFlipCache.get(key) ?? false;
    const outcome = isFlipped ? flipOutcome(row.outcome) : row.outcome;
    inserts.push({ matchId, bookmaker: row.bookmaker as any, marketType: row.marketType as any, outcome: outcome as any, price: row.price, lineValue: row.lineValue ?? null, recordedAt: now });
  }

  if (inserts.length > 0) {
    await prisma.oddsSnapshot.createMany({ data: inserts });
  }
}

async function pruneOldSnapshots(): Promise<void> {
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60_000);
  await prisma.oddsSnapshot.deleteMany({ where: { recordedAt: { lt: cutoff } } });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function checkAndSendAlerts(rows: NrlOddsRow[], priorPrices: Map<string, number>): Promise<void> {
  const prefs = (await prisma.alertPreferences.findMany({
    where: { OR: [{ alertNewArb: true }, { alertSteamMove: true }, { alertHighEv: true }, { alertHotBets: true }] },
  })) as unknown as AlertPrefRow[];
  if (prefs.length === 0) return;

  const byMatch = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date)) ? matchKey(homeTeam, awayTeam, date) : matchKey(awayTeam, homeTeam, date);
    const matchId = matchIdCache.get(key);
    if (!matchId) continue;
    if (!byMatch.has(matchId)) byMatch.set(matchId, []);
    byMatch.get(matchId)!.push({ ...row, homeTeam, awayTeam });
  }

  const allPushSubs = (await prisma.pushSubscription.findMany({ where: { userId: { in: prefs.map(p => p.userId) } } })) as unknown as PushSubRow[];
  const pushSubsByUser = new Map<string, PushSubRow[]>();
  for (const sub of allPushSubs) {
    if (!pushSubsByUser.has(sub.userId)) pushSubsByUser.set(sub.userId, []);
    pushSubsByUser.get(sub.userId)!.push(sub);
  }

  for (const pref of prefs) {
    const to = pref.email ?? "";
    const toPhone = pref.phone ?? "";
    const pushSubs = pushSubsByUser.get(pref.userId) ?? [];
    if (!to && !toPhone && !pushSubs.length) continue;

    const alreadySent = new Set(
      ((await prisma.alertLog.findMany({ where: { userId: pref.userId, sentAt: { gte: new Date(Date.now() - 60 * 60_000) } } })) as unknown as AlertLogRow[])
        .map(l => `${l.alertType}|${l.key}`)
    );

    const logAlert = (type: string, key: string) =>
      prisma.alertLog.upsert({
        where: { userId_alertType_key: { userId: pref.userId, alertType: type, key } },
        create: { userId: pref.userId, alertType: type, key },
        update: { sentAt: new Date() },
      });

    if (pref.alertSteamMove) {
      const threshold = Number(pref.steamMoveThreshold);
      for (const [matchId, matchRows] of byMatch) {
        const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
        for (const row of matchRows) {
          const kd = row.kickoffAt.toISOString().slice(0, 10);
          const isFlipped = matchFlipCache.get(matchIdCache.has(matchKey(row.homeTeam, row.awayTeam, kd)) ? matchKey(row.homeTeam, row.awayTeam, kd) : matchKey(row.awayTeam, row.homeTeam, kd)) ?? false;
          const outcome = isFlipped ? flipOutcome(row.outcome) : row.outcome;
          const priorKey = `${matchId}|${row.bookmaker}|${row.marketType}|${outcome}`;
          const prior = priorPrices.get(priorKey);
          if (!prior) continue;
          const changePct = ((row.price - prior) / prior) * 100;
          if (Math.abs(changePct) < threshold) continue;
          const alertKey = `${priorKey}|${row.price}`;
          if (alreadySent.has(`steam|${alertKey}`)) continue;
          const html = steamAlertHtml(matchName, row.bookmaker, outcome, prior, row.price, changePct);
          const sms  = steamAlertSms(matchName, row.bookmaker, outcome, prior, row.price);
          if (to) await sendEmail(to, `Steam move: ${row.bookmaker} ${matchName}`, html).catch(() => {});
          if (toPhone) await sendSms(toPhone, sms).catch(() => {});
          if (pushSubs.length) await sendPush(pushSubs, `Steam move: ${row.bookmaker}`, sms, "/line-movement").catch(() => {});
          await logAlert("steam", alertKey);
        }
      }
    }

    if (pref.alertHotBets) {
      const threshold = Number(pref.hotBetsThreshold);
      for (const [matchId, matchRows] of byMatch) {
        const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
        const movers = new Map<string, number>();
        for (const row of matchRows) {
          const prior = priorPrices.get(`${matchId}|${row.bookmaker}|${row.marketType}|${row.outcome}`);
          if (!prior) continue;
          const changePct = ((row.price - prior) / prior) * 100;
          if (Math.abs(changePct) < threshold) continue;
          const k = `${row.marketType}|${row.outcome}|${changePct < 0 ? "short" : "drift"}`;
          movers.set(k, (movers.get(k) ?? 0) + 1);
        }
        for (const [outcomeKey, count] of movers) {
          if (count < 2) continue;
          const alertKey = `${matchId}|${outcomeKey}`;
          if (alreadySent.has(`hot|${alertKey}`)) continue;
          const [, outcome, dir] = outcomeKey.split("|");
          const msg = `Hot bet: ${matchName} — ${outcome} ${dir === "short" ? "shortening" : "drifting"} on ${count} books`;
          if (to) await sendEmail(to, `Hot Bet: ${matchName}`, `<p>${msg}</p>`).catch(() => {});
          if (toPhone) await sendSms(toPhone, msg).catch(() => {});
          if (pushSubs.length) await sendPush(pushSubs, "Hot Bet", msg, "/line-movement").catch(() => {});
          await logAlert("hot", alertKey);
        }
      }
    }

    if (pref.alertNewArb) {
      const minRoi = Number(pref.minArbRoi);
      for (const [matchId, matchRows] of byMatch) {
        const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
        const homeOdds = matchRows.filter(r => r.outcome === "home" && r.marketType === "h2h");
        const awayOdds = matchRows.filter(r => r.outcome === "away" && r.marketType === "h2h");
        if (!homeOdds.length || !awayOdds.length) continue;
        const bestHome = homeOdds.reduce((b, r) => r.price > b.price ? r : b);
        const bestAway = awayOdds.reduce((b, r) => r.price > b.price ? r : b);
        const result = detectTwoWayArbitrage([
          { sportsbook: bestHome.bookmaker, selection: "home", odds: bestHome.price },
          { sportsbook: bestAway.bookmaker, selection: "away", odds: bestAway.price },
        ]);
        if (!result || result.roiPercent < minRoi) continue;
        const alertKey = `${matchId}-h2h-${bestHome.bookmaker}-${bestAway.bookmaker}-${result.roiPercent.toFixed(2)}`;
        if (alreadySent.has(`arb|${alertKey}`)) continue;
        const legs = [
          { bookmaker: bestHome.bookmaker, outcome: bestHome.homeTeam, odds: bestHome.price, stake: result.legs[0].stake },
          { bookmaker: bestAway.bookmaker, outcome: bestAway.awayTeam, odds: bestAway.price, stake: result.legs[1].stake },
        ];
        const html = arbAlertHtml(matchName, result.roiPercent, legs);
        const sms  = arbAlertSms(matchName, result.roiPercent);
        if (to) await sendEmail(to, `Arb found: +${result.roiPercent.toFixed(2)}% on ${matchName}`, html).catch(() => {});
        if (toPhone) await sendSms(toPhone, sms).catch(() => {});
        if (pushSubs.length) await sendPush(pushSubs, `Arb: +${result.roiPercent.toFixed(2)}%`, `${matchName} — guaranteed profit`, "/arbitrage").catch(() => {});
        await logAlert("arb", alertKey);
      }
    }
  }
}

async function checkMatchAlerts(rows: NrlOddsRow[], priorPrices: Map<string, number>): Promise<void> {
  const matchAlerts = (await prisma.matchAlert.findMany()) as unknown as MatchAlertRow[];
  if (matchAlerts.length === 0) return;

  const userIds = [...new Set(matchAlerts.map(a => a.userId))];
  const [prefsRaw, pushSubsRaw] = await Promise.all([
    prisma.alertPreferences.findMany({ where: { userId: { in: userIds } } }),
    prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
  ]);
  const prefs      = prefsRaw   as unknown as AlertPrefRow[];
  const allPushSubs = pushSubsRaw as unknown as PushSubRow[];
  const prefMap = new Map<string, AlertPrefRow>(prefs.map(p => [p.userId, p]));
  const pushSubsByUser = new Map<string, PushSubRow[]>();
  for (const sub of allPushSubs) {
    if (!pushSubsByUser.has(sub.userId)) pushSubsByUser.set(sub.userId, []);
    pushSubsByUser.get(sub.userId)!.push(sub);
  }

  const byMatch = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date)) ? matchKey(homeTeam, awayTeam, date) : matchKey(awayTeam, homeTeam, date);
    const matchId = matchIdCache.get(key);
    if (!matchId) continue;
    if (!byMatch.has(matchId)) byMatch.set(matchId, []);
    byMatch.get(matchId)!.push({ ...row, homeTeam, awayTeam });
  }

  for (const alert of matchAlerts) {
    const matchRows = byMatch.get(alert.matchId);
    if (!matchRows?.length) continue;

    const pref = prefMap.get(alert.userId);
    const to = pref?.email ?? "";
    const toPhone = pref?.phone ?? "";
    const pushSubs = pushSubsByUser.get(alert.userId) ?? [];
    if (!to && !toPhone && !pushSubs.length) continue;

    const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
    const alertType = `match_${alert.alertType}`;
    const recentLogs = (await prisma.alertLog.findMany({ where: { userId: alert.userId, alertType, sentAt: { gte: new Date(Date.now() - 60 * 60_000) } } })) as unknown as AlertLogRow[];
    const alreadySent = new Set(recentLogs.map(l => l.key));

    const logAlert = (key: string) =>
      prisma.alertLog.upsert({
        where: { userId_alertType_key: { userId: alert.userId, alertType, key } },
        create: { userId: alert.userId, alertType, key },
        update: { sentAt: new Date() },
      });

    const notify = async (title: string, body: string, url: string) => {
      if (to) await sendEmail(to, title, `<p>${body}</p>`).catch(() => {});
      if (toPhone) await sendSms(toPhone, body).catch(() => {});
      if (pushSubs.length) await sendPush(pushSubs, title, body, url).catch(() => {});
    };

    if (alert.alertType === "best_odds") {
      for (const outcome of ["home", "away"] as const) {
        const best = matchRows.filter(r => r.outcome === outcome && r.marketType === "h2h").reduce<NrlOddsRow | null>((b, r) => (!b || r.price > b.price ? r : b), null);
        if (!best) continue;
        const prior = priorPrices.get(`${alert.matchId}|${best.bookmaker}|h2h|${outcome}`);
        if (!prior || best.price <= prior) continue;
        const key = `${alert.matchId}|${outcome}|${best.price}`;
        if (alreadySent.has(key)) continue;
        await notify("Odds improved", `Best odds improved: ${matchName} ${outcome} @ ${best.price} (${best.bookmaker})`, "/nrl");
        await logAlert(key);
      }
    }

    if (alert.alertType === "line_move") {
      const threshold = Number(alert.threshold ?? 10);
      for (const row of matchRows) {
        const prior = priorPrices.get(`${alert.matchId}|${row.bookmaker}|${row.marketType}|${row.outcome}`);
        if (!prior) continue;
        const changePct = ((row.price - prior) / prior) * 100;
        if (Math.abs(changePct) < threshold) continue;
        const key = `${alert.matchId}|${row.bookmaker}|${row.outcome}|${row.price}`;
        if (alreadySent.has(key)) continue;
        await notify("Line move", `Line move: ${matchName} — ${row.outcome} ${changePct < 0 ? "shortened" : "drifted"} to ${row.price} on ${row.bookmaker}`, "/line-movement");
        await logAlert(key);
      }
    }

    if (alert.alertType === "arb") {
      const homeOdds = matchRows.filter(r => r.outcome === "home" && r.marketType === "h2h");
      const awayOdds = matchRows.filter(r => r.outcome === "away" && r.marketType === "h2h");
      if (!homeOdds.length || !awayOdds.length) continue;
      const bestHome = homeOdds.reduce((b, r) => r.price > b.price ? r : b);
      const bestAway = awayOdds.reduce((b, r) => r.price > b.price ? r : b);
      const result = detectTwoWayArbitrage([
        { sportsbook: bestHome.bookmaker, selection: "home", odds: bestHome.price },
        { sportsbook: bestAway.bookmaker, selection: "away", odds: bestAway.price },
      ]);
      if (!result) continue;
      const key = `${alert.matchId}|arb|${result.roiPercent.toFixed(2)}`;
      if (alreadySent.has(key)) continue;
      await notify("Arb found", `Arb on ${matchName}: +${result.roiPercent.toFixed(2)}% ROI (${bestHome.bookmaker} / ${bestAway.bookmaker})`, "/arbitrage");
      await logAlert(key);
    }
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runPollCycle(): Promise<{ oddsCount: number; matchCount: number; durationMs: number }> {
  const started = Date.now();

  const [apiRows, bet365Rows, oddsPortalRows] = await Promise.all([
    oddsApiAdapter.fetch().catch((err) => { console.error("[Poll] TheOddsApi failed:", err.message); return [] as NrlOddsRow[]; }),
    bet365Adapter.fetch().catch((err)  => { console.error("[Poll] Bet365 failed:", err.message);     return [] as NrlOddsRow[]; }),
    oddsPortalAdapter.fetch().catch((err) => { console.error("[Poll] OddsPortal failed:", err.message); return [] as NrlOddsRow[]; }),
  ]);

  const rows = [...apiRows, ...bet365Rows, ...oddsPortalRows];
  let oddsCount = 0;
  let matchCount = 0;

  if (rows.length > 0) {
    const uniqueEvents = deduplicateEvents(rows);
    await upsertMatches(uniqueEvents);
    const priorPrices = await fetchCurrentPrices();
    oddsCount  = await upsertOdds(rows);
    matchCount = uniqueEvents.length;
    void saveSnapshots(rows).catch(e => console.warn("[Poll] Snapshot save failed:", e.message));
    void pruneOldSnapshots().catch(() => {});
    void checkAndSendAlerts(rows, priorPrices).catch(e => console.warn("[Poll] Alert check failed:", e.message));
    void checkMatchAlerts(rows, priorPrices).catch(e => console.warn("[Poll] Match alert check failed:", e.message));
  } else {
    console.warn("[Poll] No odds rows returned from any source");
  }

  return { oddsCount, matchCount, durationMs: Date.now() - started };
}
