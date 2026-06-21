# EdgeBoard — MVP Sprint Backlog

**Target launch:** 30 days from 2026-06-20 → **2026-07-20**  
**Today:** 2026-06-21  
**Days remaining:** 29  
**Owner:** Troy Flavell (solo)

---

## What Is Already Done

| Area | Status |
|---|---|
| Database schema (matches + odds) | ✅ Pushed to Supabase |
| Prisma schema (MVP models only) | ✅ Generated |
| Supabase client helpers (server / client / middleware) | ✅ |
| Odds ingestion worker (DB writes, match auto-create) | ✅ |
| The Odds API adapter — 11 AU bookmakers, 266 rows | ✅ Tested E2E |
| Bet365 Playwright scraper (graceful failure) | ✅ Written |
| Arb detection functions (2-way, 3-way) | ✅ In `src/lib/utils/arbitrage.ts` |
| EV + fair odds calc functions | ✅ In `src/lib/utils/odds.ts` |
| Supabase Realtime enabled on odds table | ✅ |

---

## What Must Be Deleted (Out of MVP Scope)

These exist in the codebase and must be removed before launch to avoid confusion and dead routes.

| File | Reason |
|---|---|
| `src/app/login/page.tsx` | No auth at MVP |
| `src/app/register/page.tsx` | No auth at MVP |
| `src/app/admin/page.tsx` | Out of PRD scope |
| `src/app/markets/[id]/page.tsx` | Out of PRD scope |
| `src/app/sportsbooks/page.tsx` | Out of PRD scope |
| `src/app/settings/page.tsx` | Out of PRD scope |
| `src/app/dashboard/page.tsx` | Replaced by home + feature pages |
| `src/app/live/page.tsx` | Merged into odds board |
| `src/app/api/alerts/route.ts` | Out of PRD scope |
| `src/app/api/subscriptions/route.ts` | Out of PRD scope |
| `src/app/api/events/route.ts` | Replaced by `/api/matches` |
| `src/lib/auth/tiers.ts` | No auth/subscription at MVP |
| `src/lib/mock-data.ts` | All routes use real DB |

---

## Dependency Graph

```
T1 Redis
  └─→ T2 Worker deploy

T3 /api/matches
  ├─→ T4 /api/arbs
  ├─→ T5 /api/ev
  └─→ T6 Odds board UI
        ├─→ T7 Best odds highlight
        ├─→ T8 Realtime + stale flag
        ├─→ T9 Arb cards UI  (also needs T4)
        ├─→ T10 EV cards UI  (also needs T5)
        └─→ T11 Responsible gambling
              └─→ T12 Homepage

T13 Geo-restriction (independent)
T14 Cleanup (independent, do first)

T2 + T7 → T15 Vercel deploy
```

---

## Sprint 1 — Infrastructure & API (Days 1–7, by 2026-06-28)

### T1 — Redis / Upstash setup
**Effort:** 1 hour  
**PRD:** Architecture §2.2 (BullMQ requires Redis)

**Acceptance criteria:**
- [ ] Upstash Redis instance created (free tier)
- [ ] `REDIS_URL` added to `.env.local` and documented for Railway
- [ ] `queue/connection.ts` connects without error on startup
- [ ] `oddsIngestionQueue.add()` completes without throwing

**Dependencies:** None  
**Blockers:** None

---

### T2 — Worker deployment (Railway)
**Effort:** 3 hours  
**PRD:** §6 (odds freshness ≤2 min)

**Acceptance criteria:**
- [ ] Railway project created, linked to repo
- [ ] Worker process starts with `npm run worker:odds`
- [ ] All env vars set: `DATABASE_URL`, `THE_ODDS_API_KEY`, `REDIS_URL`
- [ ] Repeating job `scrape:nrl` fires every 120s — visible in BullMQ logs
- [ ] Supabase `odds.updated_at` timestamps advance every ~2 minutes
- [ ] Worker deployed to **Sydney region** (required for Bet365 AU IP access)

**Dependencies:** T1  
**Blockers:** T1 (need Redis URL before deploying)

---

### T14 — Codebase cleanup (remove out-of-scope stubs)
**Effort:** 1 hour  
**PRD:** CLAUDE.md §2 (MVP scope is a hard boundary)

**Acceptance criteria:**
- [ ] All files in the "What Must Be Deleted" table above are removed
- [ ] No broken imports remain after deletion (`npx tsc --noEmit` passes)
- [ ] Middleware `protectedRoutes` list updated to only include routes that exist

**Dependencies:** None  
**Blockers:** None  
**Note:** Do this first — cleaner codebase makes everything else faster.

---

### T3 — `/api/matches` route (real DB, best odds)
**Effort:** 3 hours  
**PRD:** §5.1 (odds board data), §5.2 (best odds server-side)

**Acceptance criteria:**
- [ ] Returns all matches with `kickoff_at` within next 7 days, status ≠ completed
- [ ] Each match includes all odds rows, grouped by market type
- [ ] Each odds row has an `is_best: boolean` field — true if it's the highest price for that outcome across all bookmakers
- [ ] Results sorted by `kickoff_at` ascending
- [ ] Response time < 500ms on cold query

**Response shape:**
```ts
{
  matches: Array<{
    id: string
    homeTeam: string
    awayTeam: string
    kickoffAt: string
    status: string
    markets: {
      h2h: OddsRow[]
      line: OddsRow[]
      total: OddsRow[]
    }
  }>
}

type OddsRow = {
  bookmaker: string
  outcome: string
  price: number
  lineValue: number | null
  deepLinkUrl: string
  updatedAt: string
  is_best: boolean
}
```

**Dependencies:** None (DB is ready, Prisma is generated)  
**Blockers:** None

---

### T4 — `/api/arbs` route (real DB)
**Effort:** 3 hours  
**PRD:** §5.3 (arb finder)

**Acceptance criteria:**
- [ ] Queries all current odds for upcoming matches
- [ ] Runs `detectTwoWayArbitrage()` across all bookmaker combinations per market
- [ ] Returns only opportunities where `roiPercent > 0`
- [ ] Each result includes: match name, market type, legs (bookmaker + outcome + odds + stake for $100), profit%
- [ ] Sorted by `roiPercent` descending
- [ ] Returns empty array (not error) when no arbs exist
- [ ] Opportunities stale > 2 min are excluded (filter by `updated_at`)

**Dependencies:** T3 (establish DB query pattern)  
**Blockers:** None

---

### T5 — `/api/ev` route (real DB)
**Effort:** 3 hours  
**PRD:** §5.4 (EV finder)

**Acceptance criteria:**
- [ ] Computes no-vig fair probability per outcome using Pinnacle method: normalise implied probs from the best available price across all bookmakers
- [ ] EV% = `(fair_prob × bookmaker_odds) - 1` — matches PRD formula exactly
- [ ] Accepts optional `?minEv=2` query param (default: 0)
- [ ] Returns only rows where `ev_pct > minEv`
- [ ] Each result includes: match, market, outcome, bookmaker, offered odds, fair odds, ev_pct, deep_link_url
- [ ] Sorted by `ev_pct` descending
- [ ] Returns empty array when no EV bets exist

**Dependencies:** T3 (establish DB query pattern)  
**Blockers:** None

---

## Sprint 2 — Core UI (Days 8–14, by 2026-07-05)

### T6 — Odds board UI (`/nrl`)
**Effort:** 1.5 days  
**PRD:** §5.1 (live odds board)

**Acceptance criteria:**
- [ ] Replaces the `TerminalPage` stub in `src/app/nrl/page.tsx`
- [ ] Displays all upcoming NRL matches (7-day window)
- [ ] Each match row shows: teams, kickoff time (AEST), bookmaker columns (one per bookmaker with data)
- [ ] Markets switchable: H2H / Line / Total (tab or toggle)
- [ ] Sorted by kickoff ascending
- [ ] Renders correctly at 375px (mobile) and 1280px+ (desktop)
- [ ] Initial data loaded server-side (Server Component calling `/api/matches`)
- [ ] Page interactive in < 3s on simulated 4G

**Dependencies:** T3  
**Blockers:** T3 must return real data

---

### T7 — Best odds highlighting
**Effort:** 0.5 days  
**PRD:** §5.2 (best available odds)

**Acceptance criteria:**
- [ ] Best price per outcome visually highlighted (green background or bold)
- [ ] When two bookmakers tie for best price, both are highlighted
- [ ] Clicking a highlighted cell opens the bookmaker's NRL page in a new tab (deep link)
- [ ] Highlighting computed from `is_best` field in API response (server-side, not client)
- [ ] A "Best Odds" summary strip per match shows best home and away price + bookmaker name

**Dependencies:** T6  
**Blockers:** None

---

### T8 — Realtime updates + stale odds flag
**Effort:** 0.5 days  
**PRD:** §5.1 AC (odds update within 30s, stale > 2 min flagged)

**Acceptance criteria:**
- [ ] Browser subscribes to Supabase Realtime on `odds` table on mount
- [ ] When a row changes, the matching cell in the odds board updates without a full page reload
- [ ] Cells where `updated_at` is > 2 minutes ago are visually flagged (greyed out or timestamp shown)
- [ ] Subscription cleaned up on component unmount (no memory leaks)

**Dependencies:** T6  
**Blockers:** None

---

## Sprint 3 — Arb + EV Features (Days 15–21, by 2026-07-12)

### T9 — Arb cards UI (`/arbitrage`)
**Effort:** 1 day  
**PRD:** §5.3 (arbitrage opportunity finder)

**Acceptance criteria:**
- [ ] Replaces `TerminalPage` stub in `src/app/arbitrage/page.tsx`
- [ ] Dedicated page separate from odds board
- [ ] Each arb card shows: match name, market type, bookmaker + outcome + odds per leg, profit%, suggested stake split for $100
- [ ] Cards sorted by profit% descending
- [ ] When a new arb appears (poll or Realtime), a toast notification fires
- [ ] Cards disappear within 60s when the opportunity closes
- [ ] "No arbitrage opportunities right now" empty state shown when list is empty
- [ ] Each bookmaker name is a clickable deep link

**Dependencies:** T4, T6 (layout/nav)  
**Blockers:** None

---

### T10 — EV cards UI (`/ev`)
**Effort:** 1 day  
**PRD:** §5.4 (positive EV finder)

**Acceptance criteria:**
- [ ] Replaces `TerminalPage` stub in `src/app/ev/page.tsx`
- [ ] Filter control: "Show EV > X%" with default 0%, options 0 / 1 / 2 / 5
- [ ] Each EV card shows: match, market, outcome, bookmaker, offered odds, fair odds, EV% badge, deep link
- [ ] A tooltip / info icon explains EV in plain language ("This bet returns more than it costs on average")
- [ ] Sorted by EV% descending
- [ ] "No positive EV bets at this threshold" empty state
- [ ] Cards refresh when underlying odds change (poll or Realtime)

**Dependencies:** T5, T6 (layout/nav)  
**Blockers:** None

---

## Sprint 4 — Polish & Launch (Days 22–29, by 2026-07-20)

### T11 — Responsible gambling notices
**Effort:** 1 hour  
**PRD:** §6 (legal requirement)

**Acceptance criteria:**
- [ ] A persistent footer or banner appears on every page
- [ ] Text includes: "Gamble responsibly" and a link to https://www.gamblinghelponline.org.au
- [ ] Not dismissible (must remain visible)
- [ ] Renders on mobile and desktop

**Dependencies:** T6 (layout exists)  
**Blockers:** None

---

### T12 — Homepage
**Effort:** 0.5 days  
**PRD:** §5.1 (entry point to all features)

**Acceptance criteria:**
- [ ] Replaces placeholder `src/app/page.tsx`
- [ ] Clear headline explaining what EdgeBoard does (1 sentence)
- [ ] Three CTA cards: "Odds Board", "Arb Finder", "EV Finder" — each linking to the relevant page
- [ ] Shows count of live bookmakers and matches covered
- [ ] Responsible gambling notice visible

**Dependencies:** T9, T10, T11  
**Blockers:** None

---

### T13 — Geo-restriction (AU only)
**Effort:** 2 hours  
**PRD:** §6 (legal requirement — AU access only)

**Acceptance criteria:**
- [ ] Vercel Edge Middleware checks `X-Vercel-IP-Country` header
- [ ] Non-AU requests receive a 403 response with a plain message ("EdgeBoard is only available in Australia")
- [ ] AU requests pass through unaffected
- [ ] Middleware runs before any page or API route

**Dependencies:** None  
**Blockers:** Requires Vercel deployment to test (header only set in production)

---

### T15 — Vercel deployment
**Effort:** 2 hours  
**PRD:** §9 Week 4 (soft launch)

**Acceptance criteria:**
- [ ] Repo connected to Vercel project
- [ ] All env vars set in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`
- [ ] `npm run build` passes with zero errors
- [ ] Production URL loads the odds board with live data from Supabase
- [ ] Geo-restriction active (T13 verified in production)
- [ ] Responsible gambling notice visible (T11)

**Dependencies:** T6 (minimum viable UI), T2 (worker running), T13  
**Blockers:** T2 must be live so production has fresh odds

---

## Summary Table

| ID | Task | Effort | Sprint | Depends On | Blocks |
|---|---|---|---|---|---|
| T14 | Cleanup out-of-scope stubs | 1h | 1 | — | nothing |
| T1 | Redis / Upstash setup | 1h | 1 | — | T2 |
| T2 | Worker deploy (Railway) | 3h | 1 | T1 | T15 |
| T3 | `/api/matches` route | 3h | 1 | — | T4, T5, T6 |
| T4 | `/api/arbs` route | 3h | 1 | T3 | T9 |
| T5 | `/api/ev` route | 3h | 1 | T3 | T10 |
| T6 | Odds board UI | 1.5d | 2 | T3 | T7, T8, T9, T10 |
| T7 | Best odds highlighting | 0.5d | 2 | T6 | — |
| T8 | Realtime + stale flag | 0.5d | 2 | T6 | — |
| T9 | Arb cards UI | 1d | 3 | T4, T6 | — |
| T10 | EV cards UI | 1d | 3 | T5, T6 | — |
| T11 | Responsible gambling | 1h | 4 | T6 | T12 |
| T12 | Homepage | 0.5d | 4 | T9, T10, T11 | — |
| T13 | Geo-restriction | 2h | 4 | — | T15 |
| T15 | Vercel deployment | 2h | 4 | T6, T2, T13 | — |

**Total estimated effort:** ~10–11 working days  
**Buffer remaining for QA / bug fixes:** ~5 days  
**Launch date target:** 2026-07-20

---

## Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bet365 Playwright scraper blocked on Railway (non-AU server) | High | Deploy worker to Railway Sydney region; test immediately after T2 |
| The Odds API quota exhausted (493 remaining on free tier) | Medium | Upgrade to Standard ($8 USD/month) before T2 goes live |
| Arb opportunities rare / never surface in test | Low | Real odds showing price differences across bookmakers — arbs will appear |
| Vercel build fails due to old enterprise code remnants | Medium | T14 (cleanup) must run before T15 |
