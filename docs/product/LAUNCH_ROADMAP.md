# EdgeBoard — Paid MVP Launch Roadmap

**Goal:** Launch a paid subscription product for Australian NRL bettors  
**Start date:** 2026-06-21  
**Target launch:** 2026-07-21 (30 days)  
**Owner:** Troy Flavell (solo)

---

## Scope Note

The original PRD scoped a read-only, no-auth MVP. This roadmap expands that scope to a **paid MVP** requiring authentication and Stripe subscriptions. That adds approximately 8–10 days of work. The 30-day window is still achievable — but only if the critical path is respected and nothing out of scope is built.

---

## Completion Status by Phase

| Phase | Status | Notes |
|---|---|---|
| P1 — Product Definition | ✅ Complete | PRD, architecture, schema, API design all documented |
| P2 — Core Platform | ✅ Complete | Supabase, Prisma, env vars, local dev working |
| P3 — Authentication | 🔴 Not started | Supabase Auth integrated but no UI or profile table |
| P4 — Subscription System | 🔴 Not started | Tier definitions scaffolded, Stripe not wired |
| P5 — Odds Ingestion | ✅ Complete | 11 AU bookmakers, 266 rows in DB, worker tested E2E |
| P6 — Intelligence Engine | 🟡 Partial | Calc functions exist; not wired to real DB or API routes |
| P7 — Frontend | 🟡 Partial | UI components exist; all pages are stubs returning mock data |
| P8 — Operations | 🔴 Not started | No error monitoring, logging, or analytics |
| P9 — Compliance | 🔴 Not started | No ToS, Privacy Policy, or responsible gambling UI |
| P10 — Launch | 🔴 Not started | No landing page, pricing page, or production deployment |

---

## 1. Dependency Graph

```
P1 Product Definition ──────────────────────────────────── ✅ DONE
P2 Core Platform ───────────────────────────────────────── ✅ DONE
P5 Odds Ingestion ──────────────────────────────────────── ✅ DONE

P3 Auth
  ├── 3.1 profiles table migration
  ├── 3.2 Register page
  ├── 3.3 Login page
  ├── 3.4 Password reset
  └── 3.5 Protected route middleware
          │
          ▼
P4 Subscriptions                        P6 Intelligence Engine
  ├── 4.1 subscriptions table           ├── 6.1 /api/matches (real DB)
  ├── 4.2 Stripe products/prices        ├── 6.2 /api/arbs (real DB)
  ├── 4.3 Checkout flow                 └── 6.3 /api/ev (real DB)
  ├── 4.4 Webhook handler
  └── 4.5 Billing portal
          │                                       │
          └──────────────┬─────────────────────── ┘
                         ▼
                  P7 Frontend
                    ├── 7.1 App shell / nav
                    ├── 7.2 Odds board (/nrl)
                    ├── 7.3 Best odds highlight
                    ├── 7.4 Realtime + stale flag
                    ├── 7.5 Arb page (/arbitrage)
                    ├── 7.6 EV page (/ev)
                    └── 7.7 Settings / billing page
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     P8 Ops         P9 Compliance  P10 Launch
  (parallel)        (parallel)
  ├── 8.1 Sentry    ├── 9.1 ToS    ├── 10.1 Landing page
  ├── 8.2 Analytics ├── 9.2 Privacy ├── 10.2 Pricing page
  └── 8.3 Uptime    └── 9.3 RG     ├── 10.3 Deploy Vercel
                                    ├── 10.4 Deploy Railway
                                    ├── 10.5 Geo-restriction
                                    └── 10.6 Domain + DNS
```

---

## 2. Critical Path

The minimum sequence that gates launch:

```
P3 Auth → P4 Stripe → P7 Frontend → P10 Deploy
```

Everything else (P6, P8, P9) can run in parallel with this chain without blocking it.

**Estimated days on critical path:**
- P3 Auth: 3 days
- P4 Stripe: 3 days
- P6 Intelligence Engine: 3 days (parallel with P4)
- P7 Frontend: 5 days
- P8/P9 Ops + Compliance: 2 days (parallel with P7)
- P10 Launch: 2 days
- **Total: ~16 working days + buffer**

---

## Phase 1 — Product Definition ✅ COMPLETE

All documents written and saved in `/docs/product/`:
- `MVP_PRD.md` — features, acceptance criteria, success metrics
- `ARCHITECTURE.md` — system design, service boundaries, data flow
- `DATABASE_SCHEMA.md` — table design, enum justification
- `INGESTION_DESIGN.md` — adapter pattern, queue architecture
- `SPRINT_BACKLOG.md` — task list with estimates and AC

---

## Phase 2 — Core Platform ✅ COMPLETE

All infrastructure is live and tested:
- Supabase project linked (`wxqdcyvvkmxqgezdfzsc`)
- `matches` and `odds` tables migrated with RLS and Realtime enabled
- Prisma schema matches DB (MVP models only)
- Supabase client helpers: `server.ts`, `client.ts`, `middleware.ts`
- `DATABASE_URL` (session pooler) and `THE_ODDS_API_KEY` in `.env.local`
- E2E test passing: 266 odds rows in Supabase

---

## Phase 3 — Authentication

**PRD impact:** Adding auth is an expansion of the original read-only PRD. It is required for a paid product. Keep it minimal — email/password only, no social login.

**Supabase Auth handles:** token issuance, session refresh, email verification, password reset links. The only custom work is UI and the profiles table.

---

### 3.1 — Profiles table migration

**Why:** Supabase Auth creates rows in `auth.users` (managed, not directly accessible via Prisma). We need a `profiles` table in the public schema to store app-level user data and link to subscriptions.

**Dependency:** None  
**Effort:** 1 hour

**Tasks:**
- Write `supabase/migrations/0004_profiles.sql`
- Create `profiles` table with `id uuid REFERENCES auth.users(id)`
- Create Postgres trigger: auto-insert into `profiles` when a new `auth.users` row is created
- Add `profiles` model to Prisma schema
- Run `supabase db push` + `prisma generate`

**Definition of done:**
- [ ] `profiles` table exists in Supabase
- [ ] Signing up via Supabase Auth dashboard auto-creates a profile row
- [ ] Prisma can query `profiles`

---

### 3.2 — Registration page

**Why:** Users need to create an account to start a trial and subscribe.

**Dependency:** 3.1  
**Effort:** 3 hours

**Tasks:**
- Replace stub `src/app/register/page.tsx` with real form
- Fields: email, password, confirm password
- Call `supabase.auth.signUp()` on submit
- Show email verification message post-signup
- Redirect to `/nrl` after email confirmed

**Definition of done:**
- [ ] User can register with email + password
- [ ] Verification email is sent (Supabase handles delivery)
- [ ] Unverified users cannot access protected routes
- [ ] Form shows inline validation errors

---

### 3.3 — Login page

**Why:** Returning users need to authenticate.

**Dependency:** 3.1  
**Effort:** 2 hours

**Tasks:**
- Replace stub `src/app/login/page.tsx` with real form
- Call `supabase.auth.signInWithPassword()` on submit
- Redirect to `?redirectTo` param if present, else `/nrl`
- Show error on wrong credentials

**Definition of done:**
- [ ] User can log in and is redirected correctly
- [ ] Invalid credentials show an error (not a JS crash)
- [ ] Session cookie is set — subsequent page loads stay authenticated

---

### 3.4 — Password reset

**Why:** Users forget passwords. Required for any paid product.

**Dependency:** 3.1  
**Effort:** 2 hours

**Tasks:**
- Add `src/app/reset-password/page.tsx` — email input, calls `supabase.auth.resetPasswordForEmail()`
- Add `src/app/update-password/page.tsx` — new password form, called from email link, calls `supabase.auth.updateUser()`

**Definition of done:**
- [ ] User enters email → receives reset link
- [ ] Link opens `/update-password` → user sets new password → redirected to login

---

### 3.5 — Protected route middleware

**Why:** Unauthenticated users must be blocked from `/nrl`, `/arbitrage`, `/ev`, `/settings`. The current middleware checks auth but redirects to a non-existent route.

**Dependency:** 3.2, 3.3  
**Effort:** 1 hour

**Tasks:**
- Verify `src/middleware.ts` correctly calls `supabase.auth.getUser()` (already implemented)
- Update redirect path to `/login` (already correct)
- Remove dead routes from `protectedRoutes` list (`/dashboard`, `/live`, `/admin`, `/markets`)
- Add `/nrl`, `/arbitrage`, `/ev`, `/settings` as protected

**Definition of done:**
- [ ] Unauthenticated `GET /nrl` → redirects to `/login?redirectTo=/nrl`
- [ ] After login, user is redirected back to original destination
- [ ] Public routes (`/`, `/login`, `/register`, `/reset-password`) are accessible without auth

---

## Phase 4 — Subscription System

**Approach:** Stripe Checkout (hosted payment page) + Stripe Customer Portal (self-service billing). This eliminates all custom payment UI — Stripe handles the card form, invoices, and cancellation flow. Total custom code is ~200 lines.

**Pricing model (MVP):**
- One paid tier: **$29 AUD/month** or **$249 AUD/year**
- 7-day free trial on first subscription
- Everything requires subscription — no permanent free tier

---

### 4.1 — Subscriptions table migration

**Why:** Track Stripe customer IDs and subscription status per user. This is the source of truth for access gating.

**Dependency:** 3.1  
**Effort:** 1 hour

**Tasks:**
- Write `supabase/migrations/0005_subscriptions.sql`
- Table: `subscriptions(id, user_id FK profiles, stripe_customer_id UNIQUE, stripe_subscription_id UNIQUE, status, trial_ends_at, current_period_end, updated_at)`
- Add model to Prisma schema + run `prisma generate`
- RLS: user can read their own row (anon cannot)

**Definition of done:**
- [ ] `subscriptions` table exists
- [ ] Prisma can query it
- [ ] A user without a subscription row is treated as inactive

---

### 4.2 — Stripe products and prices

**Why:** Stripe needs products and price objects before Checkout sessions can be created.

**Dependency:** None (done in Stripe dashboard, not code)  
**Effort:** 30 minutes

**Tasks:**
- Create Stripe account (use Australian entity — affects tax handling)
- Create product: "EdgeBoard Pro"
- Create two prices: $29 AUD/month recurring, $249 AUD/year recurring
- Enable 7-day free trial on both prices
- Copy price IDs to `.env.local` as `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`
- Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to env

**Definition of done:**
- [ ] Both prices visible in Stripe dashboard
- [ ] Price IDs in `.env.local`

---

### 4.3 — Checkout flow

**Why:** Users need a way to start a subscription.

**Dependency:** 4.1, 4.2  
**Effort:** 3 hours

**Tasks:**
- `src/app/api/checkout/route.ts` — POST handler:
  1. Get authenticated user from Supabase session
  2. Create or retrieve Stripe customer (store `stripe_customer_id` in `subscriptions` table)
  3. Create Stripe Checkout Session with the selected price ID, `trial_period_days: 7`, success/cancel URLs
  4. Return `{ url }` — client redirects to Stripe hosted checkout
- Trigger: "Start Trial" button on pricing page and paywall prompt

**Definition of done:**
- [ ] Clicking "Start Trial" redirects to Stripe Checkout
- [ ] After payment, Stripe redirects to `/nrl?checkout=success`
- [ ] Stripe customer ID is saved to `subscriptions` table

---

### 4.4 — Stripe webhook handler

**Why:** Stripe notifies us of subscription state changes (created, renewed, cancelled, payment failed). The webhook is the only reliable way to keep our DB in sync with Stripe.

**Dependency:** 4.3  
**Effort:** 3 hours

**Tasks:**
- `src/app/api/webhooks/stripe/route.ts` — POST handler:
  - Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`
  - Handle events:
    - `checkout.session.completed` → set status = `trialing` or `active`, store subscription ID
    - `customer.subscription.updated` → update status, `current_period_end`
    - `customer.subscription.deleted` → set status = `canceled`
    - `invoice.payment_failed` → set status = `past_due`
- Register webhook URL in Stripe dashboard pointing to `https://yourdomain.com/api/webhooks/stripe`

**Definition of done:**
- [ ] All four events update `subscriptions.status` correctly
- [ ] Webhook rejects requests with invalid signatures (returns 400)
- [ ] Tested with `stripe listen --forward-to localhost:3000/api/webhooks/stripe` locally

---

### 4.5 — Subscription access gating

**Why:** Users without an active subscription must be blocked from arb/EV features and shown a paywall prompt.

**Dependency:** 4.4  
**Effort:** 2 hours

**Tasks:**
- `src/lib/subscription.ts` — `getSubscriptionStatus(userId)` — queries `subscriptions` table, returns `active | trialing | inactive`
- In protected API routes (`/api/arbs`, `/api/ev`): check subscription status, return 403 + `{ error: 'subscription_required' }` if inactive
- In protected pages: check status server-side in Server Component, show `<PaywallPrompt />` if inactive
- `PaywallPrompt` component: brief message + "Start 7-Day Free Trial" button linking to checkout

**Definition of done:**
- [ ] Active subscriber: full access to arb + EV
- [ ] Inactive user: sees paywall prompt, not the content
- [ ] Trialing user: full access
- [ ] Expired/cancelled: sees paywall prompt

---

### 4.6 — Billing management page (Settings)

**Why:** Users need to cancel, upgrade, or view invoices without contacting support. Stripe Customer Portal handles this entirely.

**Dependency:** 4.4  
**Effort:** 2 hours

**Tasks:**
- `src/app/api/billing-portal/route.ts` — POST handler: creates Stripe Customer Portal session, returns redirect URL
- Replace `src/app/settings/page.tsx` stub with:
  - Current plan + next billing date (from `subscriptions` table)
  - "Manage Billing" button → hits `/api/billing-portal` → redirects to Stripe portal
  - Portal handles: cancel, update payment method, view invoices

**Definition of done:**
- [ ] Authenticated subscriber clicks "Manage Billing" → Stripe portal opens
- [ ] Cancelling in portal → webhook fires → `subscriptions.status` = `canceled`
- [ ] Settings page shows current plan status (active / trialing / canceled)

---

## Phase 5 — Odds Ingestion ✅ COMPLETE

All ingestion infrastructure is built and end-to-end tested:

| Component | Status |
|---|---|
| The Odds API adapter (11 AU bookmakers) | ✅ Tested — 266 rows written to Supabase |
| Bet365 Playwright scraper | ✅ Written — needs AU server IP to activate |
| Sportsbet stub adapter | ✅ (served via The Odds API) |
| TAB stub adapter | ✅ (served via The Odds API) |
| Odds normalisation | ✅ `NrlOddsRow` type + market/outcome mapping |
| BullMQ worker | ✅ Upserts matches + odds on each run |
| Match auto-creation | ✅ Worker creates missing match rows |

**Remaining for P5:**
- Redis (Upstash) setup — 1 hour (blocks worker deployment)
- Worker deployed to Railway Sydney region — 3 hours

---

## Phase 6 — Intelligence Engine

The calculation functions exist in `src/lib/utils/`. This phase wires them to real DB data and exposes them via API routes.

---

### 6.1 — `/api/matches` (real DB, best odds)

**Why:** The odds board page and all downstream features depend on this. Currently `/api/odds` returns mock data.

**Dependency:** P2 complete  
**Effort:** 3 hours

**What to build:**
- New route at `src/app/api/matches/route.ts` (replace `/api/odds` and `/api/events`)
- Query: matches with `kickoff_at` in next 7 days, status ≠ completed, include all odds rows
- Compute `is_best: boolean` server-side per outcome across all bookmakers
- Response sorted by `kickoff_at` ascending

**Definition of done:**
- [ ] Returns live data from Supabase (not mock)
- [ ] Each odds row has correct `is_best` flag
- [ ] Response time < 500ms

---

### 6.2 — `/api/arbs` (real DB)

**Why:** Arb finder UI depends on this. `detectTwoWayArbitrage()` function already exists — just needs real odds piped in.

**Dependency:** 6.1 (establishes DB query pattern)  
**Effort:** 3 hours

**What to build:**
- `src/app/api/arbs/route.ts`
- Query all current odds → group by match + market → run `detectTwoWayArbitrage()` across all bookmaker combinations → return opportunities where `roiPercent > 0`, sorted descending
- Filter out odds with `updated_at` > 2 minutes (stale)
- Include subscription check: return 403 if user is not active/trialing

**Definition of done:**
- [ ] Returns real arb opportunities (or empty array)
- [ ] Inactive subscribers get 403
- [ ] ROI% and stake splits are mathematically correct

---

### 6.3 — `/api/ev` (real DB)

**Why:** EV finder UI depends on this. `expectedValuePercent()` and `consensusProbability()` functions already exist.

**Dependency:** 6.1  
**Effort:** 3 hours

**What to build:**
- `src/app/api/ev/route.ts`
- No-vig fair probability: take all bookmaker prices per outcome → compute implied probs → normalise to 100% → that's the fair probability
- EV% = `(fair_prob × offered_odds) - 1` for each bookmaker × outcome combination
- Accept `?minEv=0` filter param
- Include subscription check

**Definition of done:**
- [ ] EV% values match manual calculation for a known input
- [ ] `?minEv=2` correctly filters below-threshold rows
- [ ] Inactive subscribers get 403

---

## Phase 7 — Frontend

**Foundation already exists:**
- Dark theme (black/zinc) with Tailwind
- `ArbCard`, `EVCard`, `OddsTable` components (need wiring to real data and updated types)
- `badge`, `button`, `card`, `input` UI primitives
- `QueryProvider` (React Query) in layout
- `useRealtimeOdds` hook (needs updating for new schema)

---

### 7.1 — App shell and navigation

**Why:** Users need consistent navigation between Odds Board, Arbs, and EV pages. The current `AppShell` component exists but isn't wired to any layout.

**Dependency:** 3.5 (auth middleware in place)  
**Effort:** 2 hours

**Tasks:**
- Update `src/components/layout/app-shell.tsx` with nav links: Odds Board, Arb Finder, EV Finder, Settings
- Show authenticated user email + "Sign out" in the header
- Wrap protected pages in `AppShell` via their layout
- `src/app/(app)/layout.tsx` — authenticated app shell layout

**Definition of done:**
- [ ] Nav renders on all protected pages
- [ ] Sign out button calls `supabase.auth.signOut()` and redirects to `/login`
- [ ] Active route is visually highlighted

---

### 7.2 — Odds board (`/nrl`)

**Why:** PRD §5.1 — the core product feature.

**Dependency:** 6.1, 7.1  
**Effort:** 1.5 days

**Tasks:**
- Replace `TerminalPage` stub in `src/app/nrl/page.tsx`
- Server Component: fetch from `/api/matches`, render match list
- Market type switcher: H2H / Line / Total tabs
- Update `OddsTable` component to accept real `Match` + `Odds` types (not mock `OddsRow`)
- Each column = one bookmaker; each row = one match; cells show decimal odds
- Sort by kickoff ascending; show kickoff time in AEST

**Definition of done:**
- [ ] All PRD §5.1 acceptance criteria met
- [ ] Live Supabase data visible (no mock data)
- [ ] Renders correctly at 375px and 1280px+
- [ ] Page interactive in < 3s on simulated 4G

---

### 7.3 — Best odds highlighting

**Why:** PRD §5.2 — differentiates EdgeBoard from just looking at bookmaker sites.

**Dependency:** 7.2  
**Effort:** 3 hours

**Tasks:**
- Green highlight (bg + text) on cells where `is_best === true`
- Wrap highlighted cell in `<a href={deepLinkUrl} target="_blank">`
- "Best Odds" summary strip per match: show best home + away price + bookmaker badge
- Handle ties (two bookmakers with identical best price — both highlighted)

**Definition of done:**
- [ ] All PRD §5.2 acceptance criteria met
- [ ] Clicking highlighted cell opens correct bookmaker URL
- [ ] Ties correctly highlighted

---

### 7.4 — Realtime updates + stale odds flag

**Why:** PRD §5.1 — odds must update in < 30s; stale > 2min must be flagged.

**Dependency:** 7.2  
**Effort:** 3 hours

**Tasks:**
- Update `useRealtimeOdds` hook to subscribe to Supabase Realtime on `odds` table (fix schema reference from `OddsSnapshot` to `odds`)
- On Realtime event: update the matching cell in React state
- Stale detection: compare cell's `updatedAt` to `Date.now()`; if > 120s, apply grey style + show tooltip "Last updated X min ago"

**Definition of done:**
- [ ] A DB price change appears in the UI within 30 seconds without page refresh
- [ ] Cells older than 2 minutes are visually greyed
- [ ] Subscription is cleaned up on unmount

---

### 7.5 — Arb finder page (`/arbitrage`)

**Why:** PRD §5.3 — core paid feature.

**Dependency:** 6.2, 7.1  
**Effort:** 1 day

**Tasks:**
- Replace `TerminalPage` stub in `src/app/arbitrage/page.tsx`
- Update `ArbCard` to accept real arb response shape (match name, market, legs with bookmaker + outcome + odds + stake, profit%)
- Poll `/api/arbs` every 60 seconds (React Query `refetchInterval`)
- Sort by `roiPercent` descending
- Toast notification when a new arb appears (compare previous response to current)
- Empty state: "No arbitrage opportunities right now. Check back during match windows."
- Paywall prompt for inactive subscribers

**Definition of done:**
- [ ] All PRD §5.3 acceptance criteria met
- [ ] Stake splits for $100 are mathematically correct
- [ ] Each leg's bookmaker name is a clickable deep link

---

### 7.6 — EV finder page (`/ev`)

**Why:** PRD §5.4 — core paid feature.

**Dependency:** 6.3, 7.1  
**Effort:** 1 day

**Tasks:**
- Replace `TerminalPage` stub in `src/app/ev/page.tsx`
- Update `EVCard` to accept real EV response shape (match, market, outcome, bookmaker, offered odds, fair odds, ev%)
- EV threshold filter: pill buttons for 0% / 1% / 2% / 5% — updates `?minEv=` query param
- Sort by EV% descending
- Info tooltip: "Positive EV means this bet returns more than it costs on average over many bets"
- Poll `/api/ev` every 60 seconds
- Paywall prompt for inactive subscribers

**Definition of done:**
- [ ] All PRD §5.4 acceptance criteria met
- [ ] EV% values are correct (spot-checked against manual calculation)
- [ ] Filter changes update results without page reload

---

### 7.7 — Settings / billing page

**Why:** Users must be able to manage their subscription without contacting support.

**Dependency:** 4.6  
**Effort:** 2 hours (mostly built in 4.6)

**Tasks:**
- Replace `settings/page.tsx` stub with subscription status + "Manage Billing" button
- Show: current plan name, status (Active / Trial / Cancelled), next billing date
- One button: "Manage Billing" → Stripe Customer Portal

**Definition of done:**
- [ ] Subscription status is accurate
- [ ] Stripe portal opens and changes reflect back via webhook

---

## Phase 8 — Operations

### 8.1 — Error monitoring (Sentry)

**Why:** When something breaks in production at 9pm on a Saturday, you need to know before a user emails you.

**Dependency:** P10 (deploy first, then observe)  
**Effort:** 2 hours

**Tasks:**
- `npm install @sentry/nextjs`
- Run `npx @sentry/wizard@latest -i nextjs`
- Wrap worker in try/catch with Sentry capture
- Set `SENTRY_DSN` in Vercel + Railway env vars

**Definition of done:**
- [ ] A thrown error in a Next.js API route appears in Sentry dashboard
- [ ] Worker job failures are captured
- [ ] Source maps uploaded (errors show line numbers, not minified code)

---

### 8.2 — Analytics (Plausible)

**Why:** Need to know which features users actually use, without sending PII to Google.

**Dependency:** P10  
**Effort:** 1 hour

**Tasks:**
- Sign up for Plausible (plausible.io — AU-friendly, privacy-first)
- Add `<Script>` tag to `layout.tsx`
- Track custom events: `arb_card_click`, `ev_card_click`, `best_odds_click`, `checkout_started`

**Definition of done:**
- [ ] Page views visible in Plausible dashboard within 24h of launch
- [ ] Custom events firing on key interactions

---

### 8.3 — Uptime monitoring

**Why:** Need to know if the odds board goes down during an NRL match window.

**Dependency:** P10  
**Effort:** 30 minutes

**Tasks:**
- Create free account on UptimeRobot or Better Uptime
- Add monitor for `https://edgeboard.com.au/api/matches`
- Set alert to email (or SMS) if down for > 2 minutes

**Definition of done:**
- [ ] Monitor active and showing green
- [ ] Test by temporarily blocking the endpoint — alert fires within 5 minutes

---

## Phase 9 — Compliance

### 9.1 — Terms of Service

**Why:** Legal requirement for any paid product. Required before processing payments.

**Dependency:** None  
**Effort:** 2 hours (use a lawyer-drafted template for AU SaaS)

**Tasks:**
- Draft or purchase AU-specific ToS template (iubenda.com or a local AU SaaS template)
- Key clauses: no guarantees on odds accuracy, no liability for betting losses, subscription terms, cancellation policy
- Add to `src/app/terms/page.tsx`
- Link from footer and registration flow

**Definition of done:**
- [ ] ToS page live at `/terms`
- [ ] Checkbox on registration: "I agree to the Terms of Service" (required)
- [ ] Reviewed by a lawyer or trusted AU SaaS template

---

### 9.2 — Privacy Policy

**Why:** Legal requirement under Australian Privacy Act 1988 (APPs). Required if collecting any personal data (email = personal data).

**Dependency:** None  
**Effort:** 1 hour (generate via iubenda or similar)

**Tasks:**
- Generate AU-compliant Privacy Policy covering: data collected (email), how it's used, Stripe as processor, Supabase as processor, user rights
- Add to `src/app/privacy/page.tsx`
- Link from footer and registration flow

**Definition of done:**
- [ ] Privacy Policy live at `/privacy`
- [ ] Linked from footer

---

### 9.3 — Responsible gambling notices

**Why:** Legal requirement under Australian Interactive Gambling Act 2001. Any service related to gambling must include responsible gambling messaging.

**Dependency:** 7.1 (layout exists)  
**Effort:** 1 hour

**Tasks:**
- Persistent footer bar on all authenticated pages: "Gambling can be addictive. For help, visit [Gambling Help Online](https://www.gamblinghelponline.org.au)"
- Not dismissible
- Included in `AppShell` so it appears on every page automatically

**Definition of done:**
- [ ] Notice visible on `/nrl`, `/arbitrage`, `/ev`, `/settings`
- [ ] GambleAware link opens in new tab
- [ ] Not dismissible via click or session storage

---

## Phase 10 — Launch

### 10.1 — Landing page

**Why:** Converts visitors to trial signups. The current homepage is a placeholder.

**Dependency:** 7.2, 7.5, 7.6 (need to know what to show)  
**Effort:** 1 day

**Tasks:**
- Replace `src/app/page.tsx` placeholder
- Hero: headline, subheadline, "Start Free Trial" CTA
- Feature cards: Odds Board, Arb Finder, EV Finder (with screenshots or descriptions)
- Social proof section: "11 Australian bookmakers. Live NRL odds." — stats from real data
- Pricing preview: "From $29 AUD/month" with link to `/pricing`
- Responsible gambling notice in footer

**Definition of done:**
- [ ] Page clearly communicates what EdgeBoard does in < 5 seconds
- [ ] "Start Free Trial" links to `/register`
- [ ] Mobile responsive

---

### 10.2 — Pricing page

**Why:** Users need to see the price before committing. Reduces checkout drop-off.

**Dependency:** 4.2 (prices exist in Stripe)  
**Effort:** 3 hours

**Tasks:**
- `src/app/pricing/page.tsx`
- Show monthly ($29 AUD) and annual ($249 AUD — save 28%) options
- List what's included: all features in the PRD
- "Start 7-Day Free Trial" → `/register` → checkout
- FAQ: cancel anytime, what happens when trial ends, refund policy

**Definition of done:**
- [ ] Monthly and annual prices displayed correctly
- [ ] CTA leads through to checkout
- [ ] FAQ answers the 3 most common objections

---

### 10.3 — Production deployment (Vercel)

**Why:** The app needs to be publicly accessible.

**Dependency:** P7 complete  
**Effort:** 2 hours

**Tasks:**
- Connect GitHub repo to Vercel
- Set all production env vars: `NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`
- Verify `npm run build` passes (fix any TypeScript errors from schema changes)
- Add custom domain (`edgeboard.com.au`) and SSL

**Definition of done:**
- [ ] Production URL loads live odds board
- [ ] SSL active, custom domain resolving
- [ ] Build has zero errors

---

### 10.4 — Worker deployment (Railway)

**Why:** Without the worker running, odds go stale immediately.

**Dependency:** T1 (Redis), P5 complete  
**Effort:** 2 hours (already planned in Sprint Backlog T2)

**Tasks:**
- Create Railway project, set region to **Sydney** (required for Bet365 AU IP)
- Set env vars: `DATABASE_URL`, `THE_ODDS_API_KEY`, `REDIS_URL`
- Deploy `npm run worker:odds`
- Verify repeating job fires every 2 minutes in Railway logs

**Definition of done:**
- [ ] Railway shows worker process as "Running"
- [ ] Supabase `odds.updated_at` timestamps advance every ~2 minutes
- [ ] Bet365 scraper returns data (AU IP confirmed working)

---

### 10.5 — Geo-restriction (AU only)

**Why:** PRD §6 legal requirement — platform must be AU-only.

**Dependency:** 10.3 (requires Vercel deployment to test)  
**Effort:** 2 hours

**Tasks:**
- Add geo check to `src/middleware.ts`: if `request.geo?.country !== 'AU'`, return 403
- Show a plain page: "EdgeBoard is only available in Australia"
- Exclude from geo-check: `/api/webhooks/stripe` (Stripe calls from US)

**Definition of done:**
- [ ] Non-AU IP → 403 page
- [ ] AU IP → normal access
- [ ] Stripe webhook endpoint bypasses geo check

---

### 10.6 — SEO basics

**Why:** Organic search is free acquisition. Basic metadata takes 1 hour.

**Dependency:** 10.1  
**Effort:** 1 hour

**Tasks:**
- Update `layout.tsx` metadata: title template, description, `og:image`
- Add `src/app/sitemap.ts` — Next.js sitemap generator for public pages
- Add `src/app/robots.ts` — allow indexing of `/`, `/pricing`, block `/nrl`, `/arbitrage`, `/ev`
- Canonical URL in metadata

**Definition of done:**
- [ ] `<title>` and `<meta description>` correct on landing, pricing pages
- [ ] `/sitemap.xml` returns valid XML
- [ ] `/robots.txt` disallows authenticated pages

---

## 3. Nice-to-Have: Defer to Post-Launch

These are in scope or adjacent to the roadmap but will slow down launch without materially affecting it.

| Item | Why Defer |
|---|---|
| Social login (Google, Apple) | Email/password is sufficient. Social adds OAuth complexity. |
| Annual subscription plan | Monthly only at launch reduces Stripe config. Add annual in week 2. |
| Multiple subscription tiers | One paid tier is simpler. Prevents "which tier do I need?" confusion. |
| Match round/season numbers | Currently stored as `round: 0`. Doesn't affect display or calculations. |
| Bet365 selector tuning | Scraper written; selectors need live AU testing post-Railway deploy. |
| Upgrade/downgrade flows | One tier = no upgrade flow needed. |
| Email notifications for arbs | Push notifications via Supabase Edge Functions. Requires accounts to be active first. |
| Admin dashboard | Railway logs + Supabase dashboard sufficient for MVP ops. |
| In-play 30-second polling | Start with 2-minute polling. Switch to 30s once pre-match is confirmed stable. |
| Blog / content marketing | Build after launch. Product must exist before content drives to it. |
| Referral or affiliate program | Post-launch once retention is understood. |
| iOS/Android app | Web-first, mobile-responsive. App after product-market fit confirmed. |

---

## 4. Minimum Launch Checklist

The absolute floor — what must be true before you can accept the first payment:

- [ ] User can register, verify email, log in
- [ ] Stripe checkout creates a subscription with 7-day trial
- [ ] Webhook updates `subscriptions.status` correctly
- [ ] Active subscriber can access `/nrl`, `/arbitrage`, `/ev`
- [ ] Inactive user sees paywall prompt
- [ ] Odds board shows live NRL data (not mock)
- [ ] Arb page shows real arb opportunities (or correct empty state)
- [ ] EV page shows real EV bets (or correct empty state)
- [ ] Realtime price updates working
- [ ] Worker running on Railway and updating odds every 2 minutes
- [ ] Terms of Service live and linked from registration
- [ ] Privacy Policy live
- [ ] Responsible gambling notice on all pages
- [ ] Geo-restriction active (AU only)
- [ ] Production deployment live on custom domain with SSL
- [ ] Stripe webhook secret set in production env

---

## 5. Market-Ready Checklist

What makes the product feel trustworthy and professional enough for word-of-mouth:

Everything in the Minimum Launch Checklist, plus:

- [ ] Landing page clearly explains the product in < 5 seconds
- [ ] Pricing page with monthly + annual options and FAQ
- [ ] Password reset flow working end-to-end
- [ ] Settings page shows subscription status and "Manage Billing" button
- [ ] Sentry error monitoring active
- [ ] Plausible analytics tracking key events
- [ ] Uptime monitor active with email alert
- [ ] Contact page or email address visible for support
- [ ] `/sitemap.xml` and `/robots.txt` in place
- [ ] OG image so Twitter/LinkedIn share looks good
- [ ] Mobile layout tested on a real iPhone (not just DevTools)
- [ ] Bet365 scraper confirmed working from Railway Sydney region

---

## 6. Post-Launch Roadmap

**Month 1 post-launch (user feedback + retention):**
- Annual subscription option
- Email notifications for new arb opportunities
- Improve Bet365 selector reliability (tune after live data from AU server)
- In-play 30-second polling when matches are live
- Add NRL round numbers to match display

**Month 2 (expand bookmaker coverage):**
- Direct Sportsbet scraper (remove reliance on The Odds API for primary bookmakers)
- Direct TAB scraper
- Neds / Ladbrokes direct scraper
- The Odds API as fallback only (reduces API cost)

**Month 3 (expand sport coverage):**
- AFL — same adapter pattern, new sport key
- A-League
- Rugby Union (Super Rugby)

**Month 4 (new features):**
- CLV tracking (closing line value — requires storing historical odds, schema change)
- Steam move detection (rapid price movement across multiple books)
- In-app push notifications (Supabase Edge Functions + Web Push)

**Month 6+ (scale):**
- Mobile app (React Native — shares all API routes)
- Sharper bookmaker coverage (Pinnacle odds as reference line)
- API access tier (for power users who want to build their own tools)

---

## Timeline Summary

| Phase | Days | Dates |
|---|---|---|
| P3 Auth | 3 | Jun 21–23 |
| P4 Stripe | 3 | Jun 24–26 |
| P5 remaining (Redis + Railway) | 1 | Jun 24 (parallel with P4) |
| P6 Intelligence Engine | 3 | Jun 27–29 |
| P7 Frontend | 5 | Jun 30–Jul 6 |
| P8 Ops + P9 Compliance | 2 | Jul 7–8 (parallel) |
| P10 Launch | 3 | Jul 9–11 |
| QA + buffer | 8 | Jul 12–20 |
| **Target launch** | | **Jul 21, 2026** |
