import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "@/workers/queue/connection";
import { oddsIngestionQueue } from "@/workers/queue/queues";
import { TheOddsApiAdapter } from "@/workers/scrapers/adapters/the-odds-api";
import { Bet365Adapter } from "@/workers/scrapers/adapters/bet365";
import { OddsPortalAdapter } from "@/workers/scrapers/adapters/oddsportal";
import type { NrlOddsRow } from "@/workers/scrapers/adapters/the-odds-api";
import { sendEmail, sendSms, sendPush, arbAlertHtml, arbAlertSms, steamAlertHtml, steamAlertSms, evAlertHtml, evAlertSms } from "@/lib/alerts";
import { detectTwoWayArbitrage } from "@/lib/utils/arbitrage";

const prisma = new PrismaClient();
const oddsApiAdapter = new TheOddsApiAdapter();
const bet365Adapter = new Bet365Adapter();
const oddsPortalAdapter = new OddsPortalAdapter();

// Match ID cache: avoids re-querying the DB for the same match within one poll cycle
const matchIdCache = new Map<string, string>();

// Kick off the first run immediately on startup
void oddsIngestionQueue.add("scrape:nrl", {}, { jobId: "scrape:nrl:boot" });

const worker = new Worker(
  "odds-ingestion",
  async () => {
    const started = Date.now();

    // Fetch from all sources in parallel — individual failures don't block the rest
    const [apiRows, bet365Rows, oddsPortalRows] = await Promise.all([
      oddsApiAdapter.fetch().catch((err) => {
        console.error("[Worker] TheOddsApi fetch failed:", err.message);
        return [] as NrlOddsRow[];
      }),
      bet365Adapter.fetch().catch((err) => {
        console.error("[Worker] Bet365 fetch failed:", err.message);
        return [] as NrlOddsRow[];
      }),
      oddsPortalAdapter.fetch().catch((err) => {
        console.error("[Worker] OddsPortal fetch failed:", err.message);
        return [] as NrlOddsRow[];
      }),
    ]);

    const rows = [...apiRows, ...bet365Rows, ...oddsPortalRows];

    let oddsCount = 0;
    let matchCount = 0;

    if (rows.length > 0) {
      const uniqueEvents = deduplicateEvents(rows);
      await upsertMatches(uniqueEvents);

      // Capture pre-upsert prices for steam move detection
      const priorPrices = await fetchCurrentPrices();

      oddsCount = await upsertOdds(rows);
      matchCount = uniqueEvents.length;

      // Save snapshot and fire alerts (non-blocking — failures don't stop the worker)
      void saveSnapshots(rows).catch(e => console.warn("[Worker] Snapshot save failed:", e.message));
      void pruneOldSnapshots().catch(() => {});
      void checkAndSendAlerts(rows, priorPrices).catch(e => console.warn("[Worker] Alert check failed:", e.message));
      void checkMatchAlerts(rows, priorPrices).catch(e => console.warn("[Worker] Match alert check failed:", e.message));
    } else {
      console.warn("[Worker] No odds rows returned from any source");
    }

    // Schedule the next run based on how close the nearest upcoming match is
    const nextMs = await calcNextPollMs();
    void oddsIngestionQueue.add("scrape:nrl", {}, { delay: nextMs });

    const durationMs = Date.now() - started;
    console.log(
      `[Worker] Done — ${oddsCount} odds, ${matchCount} matches, ${durationMs}ms · next poll in ${Math.round(nextMs / 60_000)}min`,
    );

    return { oddsCount, matchCount, durationMs, nextPollMs: nextMs };
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

console.log("[Worker] Odds ingestion worker started");

// ─── Poll interval logic ─────────────────────────────────────────────────────
//
// NRL odds move at predictable moments:
//   < 3h to kickoff  → every 2 min  (final line moves, sharp money)
//   < 24h            → every 5 min  (game day movement)
//   < 72h            → every 15 min (team announcement territory — ~48h before kickoff)
//   3–7 days out     → every 60 min (quiet, odds barely move)
//   No matches       → every 6h     (off-season / bye round)

async function calcNextPollMs(): Promise<number> {
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const next = await prisma.match.findFirst({
    where: { kickoffAt: { gte: now, lte: sevenDaysOut }, status: "upcoming" },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });

  if (!next) return 6 * 60 * 60_000; // 6 hours — no matches coming up

  const hoursOut = (next.kickoffAt.getTime() - now.getTime()) / 3_600_000;

  if (hoursOut < 3)  return 2  * 60_000;  // 2 min
  if (hoursOut < 24) return 5  * 60_000;  // 5 min
  if (hoursOut < 72) return 15 * 60_000;  // 15 min
  return 60 * 60_000;                      // 60 min
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// OddsPortal uses longer official names; The Odds API uses shorter ones.
// Normalize everything to the short canonical form before DB lookups.
const TEAM_ALIASES: Record<string, string> = {
  "cronulla sutherland sharks": "Cronulla Sharks",
  "manly warringah sea eagles": "Manly Sea Eagles",
  "nq cowboys":                 "North Queensland Cowboys",
  "st george illawarra dragons":"St. George Illawarra Dragons",
};

function normalizeTeam(name: string): string {
  return TEAM_ALIASES[name.toLowerCase()] ?? name;
}

type EventSummary = Pick<NrlOddsRow, "externalEventId" | "homeTeam" | "awayTeam" | "kickoffAt">;

// Tracks whether a source listed teams in opposite order to the canonical DB record.
// When flipped, home↔away outcomes must be swapped before storing.
const matchFlipCache = new Map<string, boolean>();

function matchKey(home: string, away: string, date: string): string {
  return `${home}|${away}|${date}`;
}

function deduplicateEvents(rows: NrlOddsRow[]): EventSummary[] {
  const seen = new Map<string, EventSummary>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    // Try both orderings so we don't create duplicate event summaries
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

    // Search both home/away orderings — sources don't always agree
    let match = await prisma.match.findFirst({
      where: {
        OR: [
          {
            homeTeam: { equals: event.homeTeam, mode: "insensitive" },
            awayTeam: { equals: event.awayTeam, mode: "insensitive" },
          },
          {
            homeTeam: { equals: event.awayTeam, mode: "insensitive" },
            awayTeam: { equals: event.homeTeam, mode: "insensitive" },
          },
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
      // Flipped if the DB record has this source's "away" team listed as home
      isFlipped = match.homeTeam.toLowerCase() !== event.homeTeam.toLowerCase();
    }

    // Register both key orderings so future rows from either source resolve correctly
    matchIdCache.set(fwdKey, match.id);
    matchIdCache.set(revKey, match.id);
    matchFlipCache.set(fwdKey, isFlipped);
    matchFlipCache.set(revKey, !isFlipped);
  }
}

function flipOutcome(outcome: string): string {
  if (outcome === "home") return "away";
  if (outcome === "away") return "home";
  return outcome; // over/under are symmetric — no flip needed
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
          where: {
            matchId_bookmaker_marketType_outcome: {
              matchId,
              bookmaker: row.bookmaker as any,
              marketType: row.marketType as any,
              outcome: outcome as any,
            },
          },
          update: {
            price: row.price,
            lineValue: row.lineValue ?? null,
            deepLinkUrl: row.deepLinkUrl,
            updatedAt: now,
          },
          create: {
            matchId,
            bookmaker: row.bookmaker as any,
            marketType: row.marketType as any,
            outcome: outcome as any,
            price: row.price,
            lineValue: row.lineValue ?? null,
            deepLinkUrl: row.deepLinkUrl,
            updatedAt: now,
          },
        });
      }),
    );

    count += eventRows.length;
  }

  return count;
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

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
  const inserts: Array<{
    matchId: string; bookmaker: any; marketType: any; outcome: any;
    price: number; lineValue: number | null; recordedAt: Date;
  }> = [];

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

    inserts.push({
      matchId,
      bookmaker: row.bookmaker as any,
      marketType: row.marketType as any,
      outcome: outcome as any,
      price: row.price,
      lineValue: row.lineValue ?? null,
      recordedAt: now,
    });
  }

  if (inserts.length > 0) {
    await prisma.oddsSnapshot.createMany({ data: inserts });
  }
}

async function pruneOldSnapshots(): Promise<void> {
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60_000); // keep 8 days
  await prisma.oddsSnapshot.deleteMany({ where: { recordedAt: { lt: cutoff } } });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function checkAndSendAlerts(rows: NrlOddsRow[], priorPrices: Map<string, number>): Promise<void> {
  const prefs = await prisma.alertPreferences.findMany({
    where: {
      OR: [{ alertNewArb: true }, { alertSteamMove: true }, { alertHighEv: true }, { alertHotBets: true }],
    },
  });
  if (prefs.length === 0) return;

  // Build current odds map for arb/EV detection
  const byMatch = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date))
      ? matchKey(homeTeam, awayTeam, date)
      : matchKey(awayTeam, homeTeam, date);
    const matchId = matchIdCache.get(key);
    if (!matchId) continue;
    if (!byMatch.has(matchId)) byMatch.set(matchId, []);
    byMatch.get(matchId)!.push({ ...row, homeTeam, awayTeam });
  }

  // Load push subscriptions keyed by userId for fast lookup
  const allPushSubs = await prisma.pushSubscription.findMany({
    where: { userId: { in: prefs.map(p => p.userId) } },
  });
  const pushSubsByUser = new Map<string, typeof allPushSubs>();
  for (const sub of allPushSubs) {
    if (!pushSubsByUser.has(sub.userId)) pushSubsByUser.set(sub.userId, []);
    pushSubsByUser.get(sub.userId)!.push(sub);
  }

  for (const pref of prefs) {
    const to = pref.email ?? "";
    const toPhone = pref.phone ?? "";
    const pushSubs = pushSubsByUser.get(pref.userId) ?? [];
    if (!to && !toPhone && !pushSubs.length) continue;

    // Sent-alert dedup keys this run
    const alreadySent = new Set(
      (await prisma.alertLog.findMany({ where: { userId: pref.userId, sentAt: { gte: new Date(Date.now() - 60 * 60_000) } } }))
        .map(l => `${l.alertType}|${l.key}`)
    );

    const logAlert = (type: string, key: string) =>
      prisma.alertLog.upsert({
        where: { userId_alertType_key: { userId: pref.userId, alertType: type, key } },
        create: { userId: pref.userId, alertType: type, key },
        update: { sentAt: new Date() },
      });

    // Steam move detection
    if (pref.alertSteamMove) {
      const threshold = Number(pref.steamMoveThreshold);
      for (const [matchId, matchRows] of byMatch) {
        const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
        for (const row of matchRows) {
          const isFlipped = matchFlipCache.get(
            matchIdCache.has(matchKey(row.homeTeam, row.awayTeam, row.kickoffAt.toISOString().slice(0,10)))
              ? matchKey(row.homeTeam, row.awayTeam, row.kickoffAt.toISOString().slice(0,10))
              : matchKey(row.awayTeam, row.homeTeam, row.kickoffAt.toISOString().slice(0,10))
          ) ?? false;
          const outcome = isFlipped ? flipOutcome(row.outcome) : row.outcome;
          const priorKey = `${matchId}|${row.bookmaker}|${row.marketType}|${outcome}`;
          const prior = priorPrices.get(priorKey);
          if (!prior) continue;
          const changePct = ((row.price - prior) / prior) * 100;
          if (Math.abs(changePct) < threshold) continue;

          const alertKey = `${priorKey}|${row.price}`;
          if (alreadySent.has(`steam|${alertKey}`)) continue;

          const html = steamAlertHtml(matchName, row.bookmaker, outcome, prior, row.price, changePct);
          const sms = steamAlertSms(matchName, row.bookmaker, outcome, prior, row.price);
          if (to) await sendEmail(to, `Steam move: ${row.bookmaker} ${matchName}`, html).catch(() => {});
          if (toPhone) await sendSms(toPhone, sms).catch(() => {});
          if (pushSubs.length) await sendPush(pushSubs, `Steam move: ${row.bookmaker}`, sms, "/line-movement").catch(() => {});
          await logAlert("steam", alertKey);
        }
      }
    }

    // Hot bet detection — same outcome shortening on 2+ books simultaneously
    if (pref.alertHotBets) {
      const threshold = Number(pref.hotBetsThreshold);
      for (const [matchId, matchRows] of byMatch) {
        const matchName = `${matchRows[0].homeTeam} vs ${matchRows[0].awayTeam}`;
        const movers = new Map<string, number>();
        for (const row of matchRows) {
          const priorKey = `${matchId}|${row.bookmaker}|${row.marketType}|${row.outcome}`;
          const prior = priorPrices.get(priorKey);
          if (!prior) continue;
          const changePct = ((row.price - prior) / prior) * 100;
          if (Math.abs(changePct) < threshold) continue;
          const dir = changePct < 0 ? "short" : "drift";
          const k = `${row.marketType}|${row.outcome}|${dir}`;
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

    // Arb detection
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
        const sms = arbAlertSms(matchName, result.roiPercent);
        if (to) await sendEmail(to, `Arb found: +${result.roiPercent.toFixed(2)}% on ${matchName}`, html).catch(() => {});
        if (toPhone) await sendSms(toPhone, sms).catch(() => {});
        if (pushSubs.length) await sendPush(pushSubs, `Arb: +${result.roiPercent.toFixed(2)}%`, `${matchName} — guaranteed profit`, "/arbitrage").catch(() => {});
        await logAlert("arb", alertKey);
      }
    }
  }
}

// ─── Match-specific alerts ────────────────────────────────────────────────────

async function checkMatchAlerts(rows: NrlOddsRow[], priorPrices: Map<string, number>): Promise<void> {
  const matchAlerts = await prisma.matchAlert.findMany();
  if (matchAlerts.length === 0) return;

  const userIds = [...new Set(matchAlerts.map(a => a.userId))];
  const [prefs, allPushSubs] = await Promise.all([
    prisma.alertPreferences.findMany({ where: { userId: { in: userIds } } }),
    prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
  ]);
  const prefMap = new Map(prefs.map(p => [p.userId, p]));
  const pushSubsByUser = new Map<string, typeof allPushSubs>();
  for (const sub of allPushSubs) {
    if (!pushSubsByUser.has(sub.userId)) pushSubsByUser.set(sub.userId, []);
    pushSubsByUser.get(sub.userId)!.push(sub);
  }

  const byMatch = new Map<string, NrlOddsRow[]>();
  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam);
    const awayTeam = normalizeTeam(row.awayTeam);
    const date = row.kickoffAt.toISOString().slice(0, 10);
    const key = matchIdCache.has(matchKey(homeTeam, awayTeam, date))
      ? matchKey(homeTeam, awayTeam, date)
      : matchKey(awayTeam, homeTeam, date);
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
    const recentLogs = await prisma.alertLog.findMany({
      where: { userId: alert.userId, alertType, sentAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    });
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
        const best = matchRows
          .filter(r => r.outcome === outcome && r.marketType === "h2h")
          .reduce<NrlOddsRow | null>((b, r) => (!b || r.price > b.price ? r : b), null);
        if (!best) continue;
        const prior = priorPrices.get(`${alert.matchId}|${best.bookmaker}|h2h|${outcome}`);
        if (!prior || best.price <= prior) continue;
        const key = `${alert.matchId}|${outcome}|${best.price}`;
        if (alreadySent.has(key)) continue;
        const msg = `Best odds improved: ${matchName} ${outcome} @ ${best.price} (${best.bookmaker})`;
        await notify("Odds improved", msg, "/nrl");
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
        const dir = changePct < 0 ? "shortened" : "drifted";
        const msg = `Line move: ${matchName} — ${row.outcome} ${dir} to ${row.price} on ${row.bookmaker}`;
        await notify("Line move", msg, "/line-movement");
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
      const msg = `Arb on ${matchName}: +${result.roiPercent.toFixed(2)}% ROI (${bestHome.bookmaker} / ${bestAway.bookmaker})`;
      await notify("Arb found", msg, "/arbitrage");
      await logAlert(key);
    }
  }
}
