# EdgeBoard — MVP Architecture

**MVP requirement:** All sections satisfy PRD §5.1–5.4  
**Constraint:** 30-day delivery, solo founder, simple over scalable  
**Last updated:** 2026-06-20

---

## Framing Decision

EdgeBoard MVP is a **read-only display product**. There are no user accounts, no write operations from users, no stored history. The only writes in the system come from the ingestion worker. This eliminates entire categories of infrastructure: no auth service, no session store, no user tables, no audit log.

Every architecture decision below flows from that constraint.

---

## 1. System Architecture

Three moving parts. Nothing else.

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (React)                   │
│  Odds Board · Best Odds · Arb Cards · EV Cards      │
│  Supabase Realtime subscription (odds table)        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────┐
│              NEXT.JS APP  (Vercel)                  │
│  /app  — React Server Components + client pages     │
│  /api  — odds aggregation, arb calc, EV calc        │
│  Edge Middleware — AU geo-restriction               │
└──────────┬───────────────────────┬──────────────────┘
           │ Prisma (server-side)  │ Supabase JS client
           │                       │ (Realtime push)
┌──────────▼───────────────────────▼──────────────────┐
│                  SUPABASE                           │
│  Postgres — matches, odds tables                    │
│  Realtime — broadcasts odds row changes to browser  │
└──────────────────────▲──────────────────────────────┘
                       │ Prisma upserts
┌──────────────────────┴──────────────────────────────┐
│            BULLMQ WORKER  (Railway)                 │
│  3 repeating jobs: sportsbet · tab · bet365         │
│  Fetches odds → parses → upserts to Postgres        │
└──────────────────────▲──────────────────────────────┘
                       │ job queue
┌──────────────────────┴──────────────────────────────┐
│            UPSTASH REDIS  (managed)                 │
│  BullMQ backing store — job state only              │
└─────────────────────────────────────────────────────┘
```

**Hosting:**

| Component | Host | Why |
|---|---|---|
| Next.js app | Vercel | Zero-config deploy, edge middleware for geo-block |
| BullMQ worker | Railway | Single `node worker.js` process, easy log access |
| Postgres + Realtime | Supabase | Managed, free tier covers MVP load |
| Redis | Upstash | Serverless Redis, free tier, no server to manage |

---

## 2. Service Boundaries

### 2.1 Next.js App

**Owns:** UI rendering, server-side computation of best odds / arb / EV, geo-restriction enforcement, responsible gambling notices.

**Does not own:** Odds ingestion, data freshness, job scheduling.

**API routes required (MVP only):**

| Route | Purpose | PRD |
|---|---|---|
| `GET /api/matches` | Returns upcoming NRL matches (7-day window) with all odds | §5.1 |
| `GET /api/arbs` | Returns current arb opportunities, sorted by profit % | §5.3 |
| `GET /api/ev` | Returns current EV bets, filtered by threshold | §5.4 |

Best odds (§5.2) are computed inside `/api/matches` — not a separate endpoint. Each odds row in the response includes an `is_best` flag set server-side.

No separate BFF, no GraphQL, no tRPC at MVP.

---

### 2.2 BullMQ Worker

**Owns:** Polling bookmakers on schedule, parsing odds responses, writing to Postgres.

**Does not own:** Serving data to the browser, computing arb/EV.

**Why a separate process?** The Next.js serverless environment cannot run persistent repeating jobs. Vercel functions are stateless and time-limited. The worker must run as a long-lived Node.js process.

**Why not a cron endpoint instead?** Cron-triggered HTTP endpoints (e.g., Vercel Cron) would work for 2-minute pre-match polling but cannot reliably sustain 30-second in-play refresh rates given cold-start latency and concurrency limits. BullMQ gives precise scheduling and retry logic without building it from scratch.

**Operational cost:** One Railway service. Restart via Railway dashboard. Logs via Railway log stream. If it dies, odds go stale — Supabase Realtime stops receiving updates, and the UI shows the stale flag after 2 minutes (PRD §5.1 AC). No cascading failure.

---

### 2.3 Supabase

**Owns:** Data persistence, real-time change broadcast to connected browsers.

**Why Realtime?** The PRD requires odds to update in the browser within 30 seconds (§5.1 AC). Supabase Realtime subscribes the browser directly to Postgres row changes via WebSocket. When the worker upserts an odds row, Supabase broadcasts it. No polling infrastructure to build.

**Why not client-side polling?** Polling at 30s works but means every user sends a full HTTP request every 30 seconds. At any real user load this creates unnecessary database reads. Realtime subscriptions are push-based; the server sends only what changed.

---

## 3. Data Flow

### 3.1 Ingestion (Worker → Supabase)

```
Every 30s (in-play) / 2min (pre-match):

1. BullMQ fires repeating job for each bookmaker
2. Worker fetches odds from bookmaker source
3. Worker parses response → normalises to internal schema
4. Worker upserts into `odds` table (match_id + bookmaker + market_type + outcome = unique key)
5. Supabase detects row change → broadcasts via Realtime channel
```

All three bookmaker jobs run independently. A failure in one does not block the others.

---

### 3.2 Display (Browser ← Next.js ← Supabase)

**Initial page load:**
```
1. Browser requests /
2. Next.js Server Component queries Supabase directly (Prisma)
3. Server computes best odds, arb list, EV list in-process
4. Returns fully-rendered HTML with data embedded
5. React hydrates — client subscribes to Supabase Realtime
```

**Subsequent updates (Realtime):**
```
1. Supabase Realtime pushes updated odds row to browser
2. Browser React state updates for that specific outcome cell
3. Best odds / arb / EV recomputed client-side on each update
   (acceptable at MVP scale; move server-side if CPU becomes an issue)
```

---

### 3.3 Arb and EV Computation

Both are computed from the `odds` table on every request. Nothing is stored.

**Arb (PRD §5.3):**
```
For each match + market:
  For each combination of bookmakers across outcomes:
    implied_prob_sum = Σ (1 / odds_for_each_outcome)
    if implied_prob_sum < 1.0:
      arb_profit% = (1 / implied_prob_sum - 1) × 100
      stake_split = calculate per outcome for $100 total
```

**EV (PRD §5.4):**
```
For each match + market:
  fair_prob per outcome = no-vig probability (Pinnacle method)
    → sum raw implied probs → divide each by the sum → normalise to 100%
  For each bookmaker odds on that outcome:
    ev% = (fair_prob × bookmaker_decimal_odds) - 1
    if ev% > 0: flag as positive EV
```

Both algorithms are pure functions. They live in `/lib/calc.ts` and are called from the API routes and client-side on Realtime updates.

---

## 4. Supabase Requirements

### 4.1 Tables

**`matches`**  
Serves: PRD §5.1 (match schedule, teams, kick-off)

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| home_team | text | |
| away_team | text | |
| kickoff_at | timestamptz | |
| round | integer | |
| season | integer | e.g. 2026 |
| status | text | upcoming \| live \| completed |
| created_at | timestamptz | |

---

**`odds`**  
Serves: PRD §5.1, §5.2, §5.3, §5.4

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| match_id | uuid (FK → matches) | |
| bookmaker | text | sportsbet \| tab \| bet365 |
| market_type | text | h2h \| line \| total |
| outcome | text | home \| away \| draw \| over \| under |
| price | numeric(6,2) | decimal odds |
| line_value | numeric(5,1) | nullable; used for line/total markets |
| deep_link_url | text | affiliate or direct URL |
| updated_at | timestamptz | set by worker on each upsert |

**Unique constraint:** `(match_id, bookmaker, market_type, outcome)` — ensures upsert replaces rather than appends.

---

### 4.2 No Other Tables at MVP

No `arb_opportunities` table — computed on read, not stored. Storing arbs would require a TTL mechanism and adds no user value since they expire in seconds anyway.

No `ev_bets` table — same reasoning.

No `users` table — no auth at MVP.

No `historical_odds` table — explicitly out of scope (PRD §4).

---

### 4.3 Realtime Configuration

- Enable Realtime on the `odds` table only
- Broadcast: `UPDATE` and `INSERT` events
- Filter: none at MVP (all NRL odds volume is manageable on one channel)
- Client subscribes via: `supabase.channel('odds').on('postgres_changes', { event: '*', schema: 'public', table: 'odds' }, handler)`

---

### 4.4 Row Level Security

All data is public-read at MVP (no user accounts). Apply:
- `odds`: `SELECT` allowed for all (anon key)
- `matches`: `SELECT` allowed for all (anon key)
- `INSERT` / `UPDATE` / `DELETE`: restricted to service role key (worker only)

---

## 5. Prisma Requirements

### 5.1 Usage

Prisma is used in two places:
1. **BullMQ worker** — upsert odds rows after each scrape
2. **Next.js API routes** — query matches + odds for server-side rendering and API responses

The browser never uses Prisma. It reads via Supabase JS client (Realtime) and Next.js API routes.

---

### 5.2 Schema (mirrors Supabase tables)

```prisma
model Match {
  id         String   @id @default(uuid())
  homeTeam   String
  awayTeam   String
  kickoffAt  DateTime
  round      Int
  season     Int
  status     String   @default("upcoming")
  createdAt  DateTime @default(now())
  odds       Odds[]
}

model Odds {
  id           String   @id @default(uuid())
  matchId      String
  bookmaker    String
  marketType   String
  outcome      String
  price        Decimal  @db.Decimal(6, 2)
  lineValue    Decimal? @db.Decimal(5, 1)
  deepLinkUrl  String
  updatedAt    DateTime @updatedAt
  match        Match    @relation(fields: [matchId], references: [id])

  @@unique([matchId, bookmaker, marketType, outcome])
}
```

---

### 5.3 Key Operations

**Worker upsert (per odds row):**
```
prisma.odds.upsert({
  where: { matchId_bookmaker_marketType_outcome: { ... } },
  update: { price, lineValue, deepLinkUrl, updatedAt },
  create: { ... all fields }
})
```

**API route — odds board query:**
```
prisma.match.findMany({
  where: {
    kickoffAt: { gte: now, lte: now + 7 days },
    status: { not: 'completed' }
  },
  include: { odds: true },
  orderBy: { kickoffAt: 'asc' }
})
```

No complex joins, no aggregations in Prisma — raw data fetched, then processed in-process.

---

## 6. BullMQ Requirements

### 6.1 Queues

One queue: `odds-ingestion`

Three repeating jobs on that queue:

| Job name | Interval (pre-match) | Interval (in-play) | Bookmaker |
|---|---|---|---|
| `scrape-sportsbet` | 120s | 30s | Sportsbet |
| `scrape-tab` | 120s | 30s | TAB |
| `scrape-bet365` | 120s | 30s | Bet365 |

In-play detection: if any match in the `matches` table has `status = 'live'`, switch to 30s interval. Checked at job start.

---

### 6.2 Job Lifecycle

```
1. Job fires
2. Fetch odds from bookmaker (HTTP request, timeout 10s)
3. Parse response → array of { matchId, bookmaker, marketType, outcome, price, deepLinkUrl }
4. Upsert all rows via Prisma (batch)
5. Job completes — BullMQ schedules next run
```

**On failure:** BullMQ retries up to 3 times with exponential backoff (default). After 3 failures, job moves to failed queue. Worker logs the error. Odds for that bookmaker go stale (UI shows stale flag after 2 minutes per PRD §5.1).

---

### 6.3 Worker Process Structure

Single file: `worker.ts`

```
- Connect to Upstash Redis
- Register repeating jobs (idempotent — safe to re-run on restart)
- Start worker with concurrency: 3 (one per bookmaker in parallel)
- Graceful shutdown on SIGTERM
```

No job dashboard (Bull Board) at MVP. Logs are sufficient. Add if debugging becomes painful.

---

### 6.4 Redis (Upstash)

Upstash free tier: 10,000 commands/day.

Estimated BullMQ commands per day:
- 3 bookmakers × (720 pre-match + 360 in-play) jobs/day × ~10 Redis ops/job ≈ 32,400 ops/day

Use Upstash paid tier ($0.20/100K commands) — approximately $0.06/day at MVP volume.

---

## 7. What Is Deliberately Not Here

| Omitted | Why |
|---|---|
| Redis caching layer | Supabase query latency is acceptable at MVP user volumes; add if P95 > 500ms |
| WebSocket server (custom) | Supabase Realtime replaces it |
| Message broker (Kafka, SQS) | Three jobs on one queue is not a distributed systems problem |
| Separate API service | Next.js API routes handle all server logic; no reason to split |
| CDN for odds data | Odds change every 30s — CDN TTL would defeat the purpose |
| Auth / user accounts | Explicitly out of PRD scope |
| Admin dashboard | Logs + Railway dashboard sufficient for MVP operations |

---

## 8. 30-Day Delivery Map

| Week | Architecture work |
|---|---|
| Week 1 | Supabase project setup, Prisma schema, BullMQ worker with one bookmaker live |
| Week 2 | All three bookmakers ingesting; Next.js app with odds board rendering live data |
| Week 3 | Arb + EV computation in API routes; Supabase Realtime wired to browser |
| Week 4 | Vercel Edge Middleware geo-block; responsible gambling component; QA; launch |
