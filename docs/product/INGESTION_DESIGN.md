# EdgeBoard — Odds Ingestion Design

**MVP requirement:** PRD §5.1 (live odds board), §6 (odds freshness ≤2min pre-match, ≤30s in-play)  
**Rule:** Simple over scalable. One working scraper beats three broken ones.  
**Last updated:** 2026-06-20

---

## Problems with the Current Scaffolding

Before designing anything new, three issues in the existing code must be resolved:

| Problem | File | Fix |
|---|---|---|
| `LadbrokesAdapter` is wired into the worker | `odds-ingestion-worker.ts` | Remove — Ladbrokes is not in PRD scope |
| All three adapters return empty arrays | `scrapers/adapters/` | Implement against a real data source |
| Worker returns event counts but never writes to DB | `odds-ingestion-worker.ts` | Add match resolution + Prisma upsert step |

---

## Data Source Decision

**MVP requirement:** PRD §6 — "Data must be obtained via official API partnerships or public-facing scraping where permitted under bookmaker ToS."

**Direct scraping reality:**
- Sportsbet and TAB expose internal JSON APIs their websites call — HTTP-fetchable, no browser needed
- Bet365 has aggressive anti-bot detection — direct HTTP scraping is unreliable without Playwright + stealth plugins, which is slow (~3s per run) and brittle

**Recommended approach: [The Odds API](https://the-odds-api.com)**

One HTTP request returns odds from Sportsbet, TAB, and Bet365 simultaneously in a normalised JSON format. This collapses three separate scrapers into one adapter call.

| | The Odds API | Direct scraping |
|---|---|---|
| Implementation time | ~2 hours | ~3 days |
| Sportsbet | ✓ | ✓ (HTTP) |
| TAB | ✓ | ✓ (HTTP) |
| Bet365 | ✓ | Playwright required |
| Breaks when bookmaker changes UI | No | Yes |
| Cost | ~$8 USD/month at 2-min polling | $0 |
| Time to first working odds | Day 1 | Day 3–5 |

**Decision: Use The Odds API for MVP.** Migrate to direct scraping post-launch if cost becomes a factor. The adapter pattern makes this a one-file swap.

---

## 1. Worker Architecture

```
┌────────────────────────────────────────────┐
│         scheduler.ts  (runs once)          │
│  Registers one repeating BullMQ job:       │
│  "scrape:nrl" every 120s                   │
└──────────────────┬─────────────────────────┘
                   │ adds job to queue
┌──────────────────▼─────────────────────────┐
│      odds-ingestion-worker.ts              │
│  Picks up "scrape:nrl" job                 │
│                                            │
│  1. Call TheOddsApiAdapter.fetch()         │
│  2. For each event returned:               │
│     a. resolveMatch(homeTeam, awayTeam,    │
│           kickoffAt) → match_id            │
│     b. If no match found: skip + log       │
│  3. Batch upsert all odds rows to Postgres │
│  4. Return { eventsCount, oddsCount }      │
└──────────────────┬─────────────────────────┘
                   │ Prisma upsert
┌──────────────────▼─────────────────────────┐
│           Supabase Postgres                │
│  odds table — upsert on                    │
│  (match_id, bookmaker, market_type,        │
│   outcome)                                 │
│                                            │
│  Supabase Realtime broadcasts the row      │
│  change to connected browsers              │
└────────────────────────────────────────────┘
```

### In-play interval switching

Pre-match polling every 120s satisfies PRD §6 (≤2min). For in-play (≤30s), the worker checks at job start whether any match is currently live:

```
if (await hasLiveMatch()) {
  // reschedule job with 30s repeat key
} else {
  // keep 120s repeat key
}
```

For the first week of launch: start with a fixed 120s interval. Add in-play detection once pre-match data is confirmed working.

### Failure behaviour

- BullMQ retries failed jobs up to 5 times with exponential backoff (already configured in `queues.ts`)
- A failed job means odds for that poll cycle go stale — the UI shows the stale flag after 2 minutes (PRD §5.1 AC)
- No cascading failure — one failed job does not affect the next scheduled run

---

## 2. Queue Architecture

**One queue. One repeating job.** The Odds API returns all three bookmakers in a single call — no reason to run parallel jobs.

```
Queue: "odds-ingestion"
  └── Job: "scrape:nrl"
        repeat: every 120s
        attempts: 5
        backoff: exponential, 2s base
        removeOnComplete: 100
        removeOnFail: 500
```

### Why not one job per bookmaker?

The existing scaffolding has three jobs (one per bookmaker). With direct scraping, this makes sense — a Bet365 failure shouldn't block Sportsbet. With The Odds API, all three bookmakers come from one HTTP call. If the call fails, all three fail together regardless. Splitting into three jobs adds retry complexity for no benefit.

When (if) we migrate to direct scraping, restore three jobs.

### Scheduler

The scheduler is a one-time startup script that registers the repeating job. BullMQ's repeat keys are idempotent — calling `add` with the same `jobId` on restart updates the existing schedule rather than creating a duplicate.

```
scheduler.ts runs → queue.add("scrape:nrl", {}, { repeat: { every: 120_000 } })
```

The scheduler is called from the worker entry point on startup. No separate process.

---

## 3. Adapter Pattern

### Interface (keep existing `SportsbookAdapter` from `base.ts`)

The adapter returns `ScrapedEvent[]`. The worker handles match resolution and DB writes. The adapter knows nothing about our database.

```
SportsbookAdapter
  key: string
  fetch(): Promise<ScrapedEvent[]>
```

`ScrapedEvent` (existing type in `base.ts`) is already correct — it has `externalEventId`, `homeTeam`, `awayTeam`, `startsAt`, and `markets[]`.

### TheOddsApiAdapter

Single adapter that calls The Odds API and returns normalised `ScrapedEvent[]`.

**API call:**
```
GET https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/odds
  ?apiKey=<key>
  &regions=au
  &markets=h2h,spreads,totals
  &bookmakers=sportsbet,tab,bet365
  &oddsFormat=decimal
```

**Response shape (simplified):**
```json
[
  {
    "id": "abc123",
    "home_team": "Brisbane Broncos",
    "away_team": "Sydney Roosters",
    "commence_time": "2026-07-03T09:50:00Z",
    "bookmakers": [
      {
        "key": "sportsbet",
        "markets": [
          {
            "key": "h2h",
            "outcomes": [
              { "name": "Brisbane Broncos", "price": 2.15 },
              { "name": "Sydney Roosters", "price": 1.75 }
            ]
          }
        ]
      }
    ]
  }
]
```

**Adapter normalisation:**
- `bookmakers[].key` → our `bookmaker` enum value
- `markets[].key` → `h2h` | `spreads` (→ `line`) | `totals` (→ `total`)
- `outcomes[].name` → resolve to `home` | `away` | `draw` | `over` | `under`
  - `name === home_team` → `home`
  - `name === away_team` → `away`
  - `name === "Over"` → `over`
  - `name === "Under"` → `under`
- `point` (on spread/total outcomes) → `line_value`

### Match resolution (in worker, not adapter)

```
resolveMatch(homeTeam, awayTeam, kickoffAt):
  SELECT id FROM matches
  WHERE home_team ILIKE $homeTeam
    AND away_team ILIKE $awayTeam
    AND kickoff_at::date = $kickoffAt::date
  LIMIT 1
```

If no match found: log a warning, skip the event. This means the NRL fixture must be seeded in `matches` before the worker runs (see `DATABASE_SCHEMA.md` migration 003).

Cache the resolved `match_id` in a local `Map` within the job run — don't re-query the DB for the same match multiple times in one poll cycle.

### Upsert (in worker, after resolution)

```
prisma.odds.upsert({
  where: { odds_unique: { matchId, bookmaker, marketType, outcome } },
  update: { price, lineValue, deepLinkUrl, updatedAt: new Date() },
  create: { matchId, bookmaker, marketType, outcome, price, lineValue, deepLinkUrl, updatedAt: new Date() }
})
```

Run all upserts in a `prisma.$transaction([...])` per event to keep them atomic. If one market fails, the whole event retries — not individual odds rows.

---

## 4. Folder Structure

Changes from current state are marked.

```
src/workers/
│
├── odds-ingestion-worker.ts     ← UPDATE: remove Ladbrokes, add DB write step
├── scheduler.ts                 ← NEW: registers repeating job on startup (~20 lines)
│
├── queue/
│   ├── connection.ts            ← keep as-is (Redis connection)
│   └── queues.ts                ← keep as-is (queue config + job type)
│
└── scrapers/
    ├── base.ts                  ← keep as-is (ScrapedEvent types + interface)
    └── adapters/
        ├── the-odds-api.ts      ← NEW: primary adapter for MVP
        ├── sportsbet.ts         ← keep stub (future direct scraping)
        ├── tab.ts               ← keep stub (future direct scraping)
        ├── bet365.ts            ← keep stub (future direct scraping)
        └── ladbrokes.ts         ← DELETE: not in MVP scope
```

**No new `lib/` files.** Match resolution and upsert logic live inline in `odds-ingestion-worker.ts`. At current complexity (~80 lines of handler code) there is no justification to split them out.

---

## 5. Environment Variables Required

Add to `.env.local` and Railway environment:

```
REDIS_URL=<upstash-redis-url>
THE_ODDS_API_KEY=<key-from-the-odds-api>
DATABASE_URL=<supabase-pooled-connection>
DIRECT_URL=<supabase-direct-connection>
```

The Odds API key: sign up at https://the-odds-api.com — free tier for initial testing, upgrade to Standard ($8 USD/month) before launch.

---

## 6. What Is Not Here

| Omitted | Why |
|---|---|
| Playwright scraping | The Odds API eliminates the need at MVP |
| Separate scraper processes per bookmaker | One API call returns all three — no need to parallelise |
| Dead letter queue / alerting | Logs + Railway dashboard sufficient at MVP; BullMQ failed queue covers inspection |
| Odds deduplication logic | The upsert constraint handles it — same data in = same row, no duplicates |
| Rate limiting / proxy rotation | The Odds API handles this; revisit only if we move to direct scraping |
