# EdgeBoard — Minimum Database Schema

**MVP requirement:** PRD §5.1–5.4  
**Rule:** Every table must justify its existence against a specific PRD requirement (CLAUDE.md §8)  
**Last updated:** 2026-06-20

---

## Framing

EdgeBoard MVP is a read-only display product. Users never write data. The only writes come from the BullMQ ingestion worker. This means:

- No user tables
- No session tables
- No audit tables
- No write-path complexity

The schema exists to answer one question efficiently: *"What are the current odds for every NRL match across three bookmakers?"* Everything else — best odds, arb, EV — is computed from that answer at read time.

---

## Rejected Tables

The following were considered and rejected before designing the schema.

| Table | Why Rejected |
|---|---|
| `arb_opportunities` | Arbs are computed from `odds` in-process. Storing them requires a TTL mechanism; they expire in seconds anyway. Pure function, not a persistence problem. |
| `ev_bets` | Same as above. EV is `(fair_prob × price) - 1` computed per request. No state to persist. |
| `users` | No auth at MVP. Explicitly out of PRD scope. |
| `sessions` | No user accounts means no sessions. |
| `historical_odds` | Explicitly deferred in PRD §7. Storing history now would consume write budget and disk with no MVP benefit. |
| `bookmakers` | Only 3 bookmakers, fixed for MVP. A lookup table is premature. Values belong in an enum. |
| `teams` | Team names are display strings. No team-level logic exists in MVP. A teams table adds a join for no benefit. |
| `markets` | Market types (h2h, line, total) are fixed for MVP. An enum, not a table. |
| `click_events` / `analytics` | Analytics is out of PRD scope. Use Vercel Analytics or Plausible externally. |

---

## 1. ERD

```
┌──────────────────────────────────────────┐
│                 matches                  │
├──────────────────────────────────────────┤
│ id             uuid        PK            │
│ home_team      text        NOT NULL      │
│ away_team      text        NOT NULL      │
│ kickoff_at     timestamptz NOT NULL      │
│ round          integer     NOT NULL      │
│ season         integer     NOT NULL      │
│ status         match_status NOT NULL     │
│                DEFAULT 'upcoming'        │
│ sportsbet_id   text        UNIQUE NULL   │
│ tab_id         text        UNIQUE NULL   │
│ bet365_id      text        UNIQUE NULL   │
│ created_at     timestamptz DEFAULT now() │
└──────────────────┬───────────────────────┘
                   │ 1
                   │
                   │ many
┌──────────────────▼───────────────────────┐
│                   odds                   │
├──────────────────────────────────────────┤
│ id             uuid        PK            │
│ match_id       uuid        FK → matches  │
│ bookmaker      bookmaker   NOT NULL      │
│ market_type    market_type NOT NULL      │
│ outcome        outcome     NOT NULL      │
│ price          numeric(6,2) NOT NULL     │
│ line_value     numeric(5,1) NULL         │
│ deep_link_url  text        NOT NULL      │
│ updated_at     timestamptz NOT NULL      │
├──────────────────────────────────────────┤
│ UNIQUE (match_id, bookmaker,             │
│         market_type, outcome)            │
└──────────────────────────────────────────┘

Enums
─────
match_status : upcoming | live | completed
bookmaker    : sportsbet | tab | bet365
market_type  : h2h | line | total
outcome      : home | away | draw | over | under
```

---

## 2. Table Explanations

### `matches`

**PRD requirement:** §5.1 — "Board displays all NRL matches with kick-off within the next 7 days. Each row shows match name, kick-off time."

**Why it exists:** The odds board requires a match schedule. Without this table there is no context to display odds against — the user would see a list of bookmaker/price pairs with no game identity.

**Column explanations:**

| Column | Reason |
|---|---|
| `home_team`, `away_team` | Required display fields (PRD §5.1 — "match name") |
| `kickoff_at` | Required for 7-day filter and sort (PRD §5.1 AC) |
| `round`, `season` | Required for grouping matches on the board (NRL-specific context) |
| `status` | Required to switch ingestion interval (30s live vs 2min pre-match, PRD §6) and to filter completed matches off the board |
| `sportsbet_id`, `tab_id`, `bet365_id` | Required for the worker to map a bookmaker's match ID to our internal match record without fuzzy team-name matching. Three nullable columns is simpler than a join table for 3 bookmakers. |
| `created_at` | Operational — helps diagnose when a match was seeded |

**What is not here:** venue, weather, referee, head-to-head record, team form — none of these satisfy any PRD requirement.

---

### `odds`

**PRD requirement:** §5.1 (display), §5.2 (best odds), §5.3 (arb finder), §5.4 (EV finder)

**Why it exists:** Every feature in the MVP is a computation over current odds. This is the only source of truth for prices.

**Column explanations:**

| Column | Reason |
|---|---|
| `match_id` | FK to associate odds with a game |
| `bookmaker` | Identifies which of the 3 bookmakers the price belongs to (PRD §5.1 — "columns for Sportsbet, TAB, Bet365") |
| `market_type` | Distinguishes H2H from line from total (PRD §3 — "Markets supported") |
| `outcome` | The specific side of the market (home/away/draw/over/under) |
| `price` | The decimal odds. Core of every feature. |
| `line_value` | The handicap or total line (e.g., +6.5, 37.5). Null for H2H. Required to display line/total markets correctly. |
| `deep_link_url` | Required by PRD §5.2 AC — "Clicking the highlighted cell deep-links to the relevant bookmaker page" |
| `updated_at` | Required by PRD §5.1 AC — "Stale odds (>2 min) are visually flagged." This is the staleness signal. |

**The unique constraint** `(match_id, bookmaker, market_type, outcome)` is load-bearing: it allows the worker to `upsert` on every poll cycle without accumulating rows. Without it, the table grows unboundedly with duplicates.

**What is not here:** odds history, previous price, movement direction, bookmaker margin — none satisfy an MVP requirement.

---

## 3. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled connection (Supabase pgBouncer)
  directUrl = env("DIRECT_URL")     // direct connection for migrations
}

enum MatchStatus {
  upcoming
  live
  completed

  @@map("match_status")
}

enum Bookmaker {
  sportsbet
  tab
  bet365

  @@map("bookmaker")
}

enum MarketType {
  h2h
  line
  total

  @@map("market_type")
}

enum Outcome {
  home
  away
  draw
  over
  under

  @@map("outcome")
}

model Match {
  id           String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  homeTeam     String      @map("home_team")
  awayTeam     String      @map("away_team")
  kickoffAt    DateTime    @map("kickoff_at") @db.Timestamptz
  round        Int
  season       Int
  status       MatchStatus @default(upcoming)
  sportsbetId  String?     @unique @map("sportsbet_id")
  tabId        String?     @unique @map("tab_id")
  bet365Id     String?     @unique @map("bet365_id")
  createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz
  odds         Odds[]

  @@map("matches")
}

model Odds {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  matchId     String     @map("match_id") @db.Uuid
  bookmaker   Bookmaker
  marketType  MarketType @map("market_type")
  outcome     Outcome
  price       Decimal    @db.Decimal(6, 2)
  lineValue   Decimal?   @map("line_value") @db.Decimal(5, 1)
  deepLinkUrl String     @map("deep_link_url")
  updatedAt   DateTime   @map("updated_at") @db.Timestamptz
  match       Match      @relation(fields: [matchId], references: [id])

  @@unique([matchId, bookmaker, marketType, outcome])
  @@index([matchId])
  @@index([updatedAt])
  @@map("odds")
}
```

**Notes on decisions:**

- `@db.Uuid` — Supabase uses native Postgres UUID type. Prisma defaults to `text` for UUIDs without this annotation.
- `directUrl` — Supabase requires a direct (non-pooled) connection for `prisma migrate`. The pooled `DATABASE_URL` is used at runtime.
- `updatedAt` on `Odds` is **not** `@updatedAt` (Prisma's auto-update field) because the value is set by the worker, not by Prisma automatically. Prisma's `@updatedAt` fires on any model update — we only want this timestamp to reflect when the bookmaker price was fetched.
- No `@@index` on `bookmaker` or `market_type` — queries always filter by `match_id` first. A compound index on those fields without `match_id` would not help the primary read pattern.

---

## 4. Supabase Migration Plan

Three migration files. Run in order via `supabase db push` or the Supabase dashboard SQL editor.

---

### Migration 1 — Create enums and tables

File: `supabase/migrations/001_initial_schema.sql`

```sql
-- Enums
CREATE TYPE match_status AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE bookmaker    AS ENUM ('sportsbet', 'tab', 'bet365');
CREATE TYPE market_type  AS ENUM ('h2h', 'line', 'total');
CREATE TYPE outcome      AS ENUM ('home', 'away', 'draw', 'over', 'under');

-- matches
CREATE TABLE matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team     TEXT        NOT NULL,
  away_team     TEXT        NOT NULL,
  kickoff_at    TIMESTAMPTZ NOT NULL,
  round         INTEGER     NOT NULL,
  season        INTEGER     NOT NULL,
  status        match_status NOT NULL DEFAULT 'upcoming',
  sportsbet_id  TEXT        UNIQUE,
  tab_id        TEXT        UNIQUE,
  bet365_id     TEXT        UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- odds
CREATE TABLE odds (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID        NOT NULL REFERENCES matches(id),
  bookmaker     bookmaker   NOT NULL,
  market_type   market_type NOT NULL,
  outcome       outcome     NOT NULL,
  price         NUMERIC(6,2) NOT NULL,
  line_value    NUMERIC(5,1),
  deep_link_url TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,

  CONSTRAINT odds_unique UNIQUE (match_id, bookmaker, market_type, outcome)
);

-- Indexes
CREATE INDEX idx_odds_match_id   ON odds (match_id);
CREATE INDEX idx_odds_updated_at ON odds (updated_at);
CREATE INDEX idx_matches_kickoff ON matches (kickoff_at)
  WHERE status != 'completed';
```

---

### Migration 2 — Row Level Security and Realtime

File: `supabase/migrations/002_rls_and_realtime.sql`

```sql
-- Enable RLS on both tables
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds    ENABLE ROW LEVEL SECURITY;

-- Public can read all matches and odds (no auth at MVP)
CREATE POLICY "public read matches"
  ON matches FOR SELECT TO anon USING (true);

CREATE POLICY "public read odds"
  ON odds FOR SELECT TO anon USING (true);

-- Only the service role (worker) can write
-- No explicit policy needed — service role bypasses RLS by default in Supabase

-- Enable Realtime on odds table
-- (Supabase requires the table to be added to the supabase_realtime publication)
ALTER PUBLICATION supabase_realtime ADD TABLE odds;
```

**Why Realtime on `odds` only and not `matches`?** Match schedules change rarely (once a day at most when results are posted). Odds change every 30 seconds. Broadcasting match changes via Realtime adds noise with no user benefit at MVP.

---

### Migration 3 — Seed NRL 2026 schedule

File: `supabase/migrations/003_seed_nrl_matches.sql`

This migration seeds the NRL 2026 season fixture for matches within the first 30 days of launch. It is a data migration, not a schema migration. Replace the placeholder rows with the actual fixture.

```sql
-- Seed upcoming NRL matches (example structure — populate with real fixture)
INSERT INTO matches (home_team, away_team, kickoff_at, round, season, status)
VALUES
  ('Brisbane Broncos',    'Sydney Roosters',    '2026-07-03 19:50:00+10', 18, 2026, 'upcoming'),
  ('Melbourne Storm',     'Penrith Panthers',   '2026-07-04 19:50:00+10', 18, 2026, 'upcoming'),
  ('South Sydney Rabbitohs', 'Parramatta Eels', '2026-07-05 15:00:00+10', 18, 2026, 'upcoming')
  -- ... continue for all Round 18+ matches within 7-day window
;
```

**Seeding strategy for launch:**
1. Pull NRL 2026 fixture from NRL.com API or a public sports data source
2. Populate this file with all remaining season matches (not just 7 days — seed the full remainder so the worker can match bookmaker IDs to internal IDs throughout the season)
3. Worker populates `sportsbet_id`, `tab_id`, `bet365_id` on first successful scrape via upsert on `(home_team, away_team, kickoff_at)` — after which it uses the ID for all subsequent upserts

---

## 5. Row Volume Estimates (MVP)

To confirm the schema is sized correctly:

| Table | Rows at MVP |
|---|---|
| `matches` | ~100 (NRL regular season remainder + finals) |
| `odds` | ~100 matches × 3 markets × 3 bookmakers × 2–3 outcomes = ~2,700 rows max |

2,700 rows is trivial. No partitioning, no archiving, no pagination strategy required for MVP.

The unique constraint means `odds` never grows beyond one row per `(match, bookmaker, market, outcome)` combination. The table size is bounded by the fixture.
```
