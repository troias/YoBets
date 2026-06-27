# EdgeBoard — Launch Roadmap

**Goal:** Launched and monetising. Now iterating toward full Pro feature set.
**Start date:** 2026-06-21
**Last updated:** 2026-06-27
**Owner:** Troy Flavell (solo)

---

## Current Status

The product is live. Core platform, auth, subscriptions, all research tools, and alert infrastructure are complete. The remaining work is Pro feature additions (CLV, ROI dashboard) and pre-launch hygiene (compliance, monitoring).

---

## Phase Completion Status

| Phase | Status | Notes |
|---|---|---|
| P1 — Product Definition | ✅ Complete | PRD updated to v2 reflecting current product |
| P2 — Core Platform | ✅ Complete | Supabase, Prisma, env vars working |
| P3 — Authentication | ✅ Complete | Google OAuth + email/password; redirectTo flows working |
| P4 — Subscription System | ✅ Complete | Stripe Checkout, webhook handler, billing portal, paywall gate |
| P5 — Odds Ingestion | ✅ Complete | 11 bookmakers, BullMQ worker, adaptive polling, Railway deployed |
| P6 — Intelligence Engine | ✅ Complete | Arb finder, EV finder, line movement, market brief, steam detection |
| P7 — Frontend | ✅ Complete | All pages live; mobile bottom nav; free-first home + pricing |
| P8 — Notifications | ✅ Complete | Web Push, email (Resend), SMS (Twilio), price alerts |
| P9 — Pro Additions | 🟡 In progress | CLV tracker and ROI dashboard pending |
| P10 — Compliance | 🔴 Not started | ToS, Privacy Policy — required before scaling |
| P11 — Operations | 🔴 Not started | Sentry, Plausible, uptime monitor |
| P12 — Affiliate | 🟡 Partial | Admin UI done; manual program signups pending |

---

## What's Been Built

### Auth (P3) ✅
- Supabase Auth with Google OAuth and email/password
- Login redirects preserve `?redirectTo` param — Google OAuth passes it through callback
- Register page: "Free to start — Pro from $19 AUD/month"
- All protected routes gated by middleware

### Subscriptions (P4) ✅
- Stripe products: Pro monthly ($19 AUD) — product `prod_UmPgHfxCcttzyp`
- Stripe products: Pro annual ($99 AUD) — product `prod_UmPzL1Ez263ESU`
- 7-day free trial on both
- `CheckoutButton` component for server-rendered checkout flows
- Webhook handler: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Billing portal via Stripe Customer Portal
- `getSubscriptionStatus()` / `isSubscribed()` helpers in `src/lib/subscription.ts`
- `PaywallGate` component with upgrade CTA

### Odds Ingestion (P5) ✅
- The Odds API: 11 AU bookmakers
- Bet365 Playwright scraper (requires Railway Sydney IP to activate)
- BullMQ worker on Railway (Sydney) with adaptive polling schedule
- Affiliate deep link override: admin sets tracking URL per bookmaker, overrides default deep link globally
- Click tracker: `/api/bet` redirect route logs click per bookmaker, redirects to affiliate URL
- Worker mode config: production / slow / off (admin panel)
- Discord webhook on each poll cycle

### Frontend (P7) ✅
- **App shell:** Desktop sidebar + mobile bottom tab bar (Odds / Arb / EV / Home) + "More" drawer
- **NRL odds board** (`/nrl`): 11 bookmakers, H2H, best price highlighted, affiliate links, price alert bells
- **Arb finder** (`/arbitrage`): Live arbs, FOMO panel, Twitter share button, upgrade CTA for free users
- **EV finder** (`/ev`): EV table, Kelly calculator, FOMO panel, Twitter share, upgrade nudge
- **Line movement** (`/line-movement`): Multi-window comparison, steam move flags, upgrade nudge
- **Market Brief** (`/brief`): Daily digest
- **Live markets** (`/live`): Matches < 2h from kickoff
- **Dashboard** (`/dashboard`): Summary stats + quick links
- **Bet tracker** (`/bets`): Log and view placed bets
- **Free bet converter** (`/free-bet-converter`)
- **Settings** (`/settings`): Active price alerts, notification prefs, billing
- **Admin** (`/admin`): Affiliate URLs, click stats, Stripe health, worker mode, Discord
- **Home page** (`/`): Free-first marketing page with pricing section, FAQ, feature showcase
- **Pricing page** (`/pricing`): Dynamic Stripe price fetch, Free vs Pro cards, annual upsell

### Notifications (P8) ✅
- Web Push (VAPID): push subscription stored, toggle in settings
- Email: Resend API
- SMS: Twilio
- Alert types: price target, EV bet, steam move, arb open
- `checkPriceAlerts()` called on every poll cycle
- `PriceAlertButton` component inline on NRL board for logged-in users
- Alert history tracked with `firedAt` timestamp — each alert fires once

---

## Remaining Work

### P9 — Pro Feature Additions

#### CLV Tracker
**What:** Log a closing price for each match outcome. Compare a user's placed bet price to the closing price. A positive CLV means you got better than the market settled at — the professional measure of betting edge.

**Why it matters for conversion:** Serious bettors pay for CLV data. It's the only metric that proves whether your betting process has edge independent of results. No Australian product does this well.

**What to build:**
- `closing_odds` table or field on `Odds` — worker stores the last price scraped before kickoff as the closing line
- `BetEntry` model extended: add `closingOdds` field (nullable — populated when match closes)
- CLV% calculation: `((placedOdds / closingOdds) - 1) × 100`
- `/bets` page: show CLV% per bet alongside P&L
- Aggregate CLV in ROI dashboard

**Effort:** ~1 day

---

#### Bet ROI Dashboard
**What:** Extend the bet tracker into a full performance dashboard. Show total bets, win rate, P&L in dollars and units, ROI%, and average CLV% over time.

**Why it matters for conversion:** Turns EdgeBoard from a research tool into a performance journal. Users who track bets become deeply engaged — they have a reason to come back daily.

**What to build:**
- Summary row at top of `/bets`: total bets, wins, P&L, ROI%, avg CLV%
- Running P&L chart (simple line chart — recharts or similar)
- Export to CSV button

**Effort:** ~1 day

---

#### Alert Deduplication
**What:** Once an alert fires for a specific condition (e.g., arb on Brisbane vs Penrith H2H at Sportsbet), don't re-fire it until the condition clears and re-triggers. Prevents alert spam.

**What to build:**
- `AlertLog` table: `userId`, `alertType`, `key` (deterministic string for the event), `sentAt`
- Before sending any alert, check if same `userId + alertType + key` exists with `sentAt` in last N hours
- Clear stale log entries on worker startup

**Effort:** ~3 hours

---

### P10 — Compliance (Required before scaling)

| Task | Notes |
|---|---|
| Terms of Service (`/terms`) | AU SaaS template; link from footer + register page |
| Privacy Policy (`/privacy`) | Australian Privacy Act 1988 (APPs); covers email, Stripe, Supabase as processors |
| Responsible gambling footer | Persistent on all authenticated pages; link to gamblinghelponline.org.au |

---

### P11 — Operations

| Task | Notes |
|---|---|
| Sentry error monitoring | `npm install @sentry/nextjs`; set `SENTRY_DSN` in Vercel + Railway |
| Plausible analytics | Add script tag; track `arb_click`, `ev_click`, `checkout_started` |
| Uptime monitor | UptimeRobot free tier; alert on `/api/matches` down > 2 min |

---

### P12 — Affiliate (Manual)

| Task | Status |
|---|---|
| Admin UI for affiliate URLs | ✅ Built |
| Sportsbet affiliate signup | ⏳ Manual |
| Ladbrokes affiliate signup | ⏳ Manual |
| Unibet affiliate signup | ⏳ Manual |
| Betfair affiliate signup | ⏳ Manual |
| Discord server + #free-alerts channel | ⏳ Manual |
| Stripe webhook registration in dashboard | ⏳ Manual |

---

## Post-Launch Roadmap

**Month 1 (retention + Pro conversion):**
- CLV tracker live
- Bet ROI dashboard live
- Alert deduplication live
- Compliance pages live

**Month 2 (bookmaker coverage):**
- Direct Sportsbet + TAB scrapers (remove Odds API dependency for primary books)
- Neds / Ladbrokes direct scrapers
- The Odds API as fallback only (reduces cost)

**Month 3 (sport expansion):**
- AFL — same adapter pattern, new sport key
- A-League

**Month 4+ (scale):**
- Pinnacle odds as reference line (sharper fair value)
- Mobile app (React Native — shares all API routes)
- API access tier for power users
