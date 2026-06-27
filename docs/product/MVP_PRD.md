# EdgeBoard — Product Requirements Document

**Version:** 2.0 (live product — updated from original pre-build spec)
**Status:** Launched — iterating
**Last updated:** 2026-06-27
**Owner:** Troy Flavell (solo)

---

## 1. Overview

EdgeBoard is a free-first odds comparison and alerts platform for Australian NRL bettors. It compares live odds across 11+ bookmakers, surfaces arbitrage opportunities and positive EV bets, tracks line movement, and — for Pro subscribers — sends push, email, and SMS notifications when a price target, EV bet, steam move, or arb appears.

**Business model:** Free tier (full research access, no card needed) + Pro subscription ($19 AUD/month or $99 AUD/year, 7-day free trial). Revenue from Pro subscriptions and bookmaker affiliate commissions.

---

## 2. Target Market

**Primary user:** Australian NRL bettor who actively shops odds across multiple bookmakers and wants an edge — either through better prices, value bets, or guaranteed profit via arbs.

**Profile:**
- Places 5–20 NRL bets per week
- Already holds accounts at multiple bookmakers
- Understands line shopping; may or may not understand EV or arbs
- Checks odds on mobile more often than desktop
- Values being notified when action is needed, not having to constantly check manually

---

## 3. Pricing Strategy

| Tier | Price | Access |
|---|---|---|
| Free | $0 — no card required | Full read access to all research tools |
| Pro (monthly) | $19 AUD/month | Everything Free + all alert types + CLV + ROI dashboard |
| Pro (annual) | $99 AUD/year (~$8.25/month) | Same as Pro monthly — saves ~57% |

**7-day free trial** on first Pro subscription. Cancel anytime from settings.

**Conversion hook:** Free users get full product visibility — they see arbs, EV bets, and line moves. The gap is that they have to manually check. Pro removes that friction entirely and adds tools for tracking their own performance.

---

## 4. Current Feature Set (Live as of 2026-06-27)

### 4.1 NRL Odds Board (`/nrl`)
- 11 Australian bookmakers side by side (Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch, PlayUp, Bet365)
- H2H markets for all upcoming NRL matches (7-day window)
- Best price per outcome visually highlighted
- Affiliate deep links — clicking a price opens the bookmaker at the correct market
- Price alert bell on each outcome — logged-in users can set a target price
- Adaptive polling: 60 min (>72h), 15 min (>24h), 5 min (>3h), 2 min (<3h to kickoff)

### 4.2 Arb Finder (`/arbitrage`)
- Detects two-way arbitrage across all bookmaker combinations
- Shows ROI%, exact stake split for any outlay, deep links for each leg
- FOMO panel: shows odds snapshot count since last visit for non-Pro users
- Twitter/X share button on each arb card

### 4.3 EV Finder (`/ev`)
- No-vig fair probability derived from best available market price (Pinnacle method)
- EV% = (fair_probability × offered_odds) − 1
- Kelly criterion stake calculator
- EV threshold filter: 0% / 1% / 2% / 5%
- Twitter/X share button on each EV row
- Upgrade nudge banner for non-Pro users

### 4.4 Line Movement Tracker (`/line-movement`)
- 1h, 6h, 24h, 48h comparison windows
- Steam move detection: flags rapid multi-book movement
- Upgrade nudge for non-Pro users

### 4.5 Market Brief (`/brief`)
- Daily digest of the best plays: top arbs, top EV bets, notable line moves

### 4.6 Live Markets (`/live`)
- Shows matches kicking off within 2 hours

### 4.7 Price Alerts (Pro)
- Users set a target price on any outcome directly from the NRL odds board
- Worker checks on every poll cycle; when price >= target, sends push + email + SMS
- Active alerts visible and removable in Settings
- Stored in `price_alerts` table; `fired_at` marks completion

### 4.8 Push / Email / SMS Notifications (Pro)
- **Push:** Web Push API (VAPID); browser permission required; toggle in settings
- **Email:** Resend API
- **SMS:** Twilio (E.164 number required; configured in settings)
- Alert types: price target hit, +EV bet appears, steam move detected, arb opens

### 4.9 Dashboard (`/dashboard`)
- Overview: live count of arbs, EV bets, line moves, upcoming matches
- Quick links to all features

### 4.10 Bet Tracker (`/bets`)
- Log placed bets: match, outcome, odds, stake, result
- Summary row: P&L, ROI%, win rate, units
- Per-bookmaker breakdown table
- CLV% per bet (closing odds vs placed odds)
- Pro gate on summary stats and CLV column

### 4.11 Free Bet Converter (`/free-bet-converter`)
- Calculates optimal hedge to convert a free bet to guaranteed cash

### 4.12 Settings (`/settings`)
- Active price alerts list with remove button
- Notification preferences: push toggle, email, phone number for SMS
- Alert thresholds: min EV%, min arb ROI%, steam move sensitivity
- Subscription status + Stripe billing portal link

### 4.13 Admin (`/admin`)
- Affiliate URL manager: set tracking URL per bookmaker
- Click tracker: counts per bookmaker (drives affiliate strategy)
- Stripe health check: green/red per env var
- Worker mode: production / slow / off
- Discord webhook URL for ops alerts

---

## 5. Pro Tier — Full Feature List

| Feature | Status |
|---|---|
| Price alerts (push/email/SMS when target hits) | ✅ Live |
| EV alerts (notified when +EV bet appears) | ✅ Live |
| Steam move alerts | ✅ Live |
| Arb alerts | ✅ Live |
| Closing Line Value (CLV) tracker | ✅ Live |
| Bet ROI dashboard (P&L, units, long-run ROI%) | ✅ Live |
| Alert deduplication (fire once per event, not repeatedly) | ✅ Live |
| Game-day digest email (9am on NRL days) | ✅ Live |
| Weekly performance summary email | ✅ Live |
| Trial email sequence (Day 1/3/6) | ✅ Live |

---

## 6. Technical Architecture

| Layer | Technology |
|---|---|
| Web app | Next.js 15 (App Router), React, Tailwind CSS |
| Database | Supabase (PostgreSQL) + Prisma ORM |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Background worker | BullMQ + Redis (Upstash), deployed on Railway (Sydney) |
| Payments | Stripe Checkout + Customer Portal + Webhooks |
| Push notifications | Web Push API (VAPID keys) |
| Email | Resend API |
| SMS | Twilio |
| Deployment | Vercel (web) + Railway (worker) |

**Polling schedule (worker — adaptive by proximity to kickoff):**
- Match > 72h away: poll every 60 min
- Match 24–72h away: poll every 15 min
- Match 3–24h away: poll every 5 min
- Match < 3h away: poll every 2 min
- No upcoming matches: poll every 6h

---

## 7. Bookmakers Covered

Sportsbet · TAB · Ladbrokes · Neds · PointsBet · Unibet · BetRight · Betr · Betfair · TABtouch · PlayUp · Bet365

Source: The Odds API (11 bookmakers) + Bet365 Playwright scraper (requires Railway Sydney IP).

---

## 8. Long-Term Vision

### The opportunity

OddsJam — a US sports betting analytics tool using the same arb/EV/line-movement model — sold for approximately **$120M USD**. They got there by covering every major US sport (NFL, NBA, MLB, NHL, NCAA) at scale.

Australia is a smaller market (~26M people vs 330M in the US) but has one of the highest per-capita sports betting rates in the world and a small number of dominant licensed bookmakers — meaning coverage is simpler to maintain. The Australian sports betting market is ~$3B AUD annually.

**Conservative ceiling (NRL only):** $300–500k AUD exit in 2–3 years if executed well.
**Realistic ceiling (NRL + AFL + cricket):** $3–10M AUD — OddsJam's Australian equivalent.
**Ceiling if expanded broadly (all major AU sports, mobile app, API tier):** $15–30M+ AUD.

The infrastructure (adaptive polling, arb/EV engine, alert stack, affiliate deep links) is sport-agnostic. Adding a new sport is primarily a data configuration and UI labelling exercise, not a re-architecture.

---

### Sport expansion priority

| Priority | Sport | Why |
|---|---|---|
| **1 — AFL** | Australian Football League | Same 11 bookmakers, same API, same bettor demographic. AFL is actually bigger than NRL nationally (Victoria, SA, WA). Season March–September overlaps and complements NRL. Doubles the addressable market. Estimated effort: 3–5 days. |
| **2 — BBL Cricket** | Big Bash League | December–February season. Fills the NRL offseason gap and keeps subscribers active year-round instead of churning. Same bookmakers. |
| **3 — A-League Soccer** | Australian football (soccer) | October–May season. Adds a third sport. Smaller but active betting market. |
| **4 — Horse racing** | All Australian codes | Largest Australian betting market by dollar volume — but technically different (tote vs fixed, fluctuating fields, many more markets). Significant engineering lift. Long-term play. |
| **5 — International sports** | NBA, EPL, tennis, UFC | Opens up international SEO and non-Australian users. Requires geo/currency handling. Post-scale. |

---

### Why not add every sport now

As a solo founder, adding sports before NRL has traction spreads effort across too many fronts. The right order:

1. Get NRL to 50+ paying subscribers and profitable affiliate revenue
2. Add AFL (same audience, most leverage, lowest effort)
3. Add BBL to close the offseason churn gap
4. Then reassess — by that point the business either has enough revenue to hire or is ready to sell

---

## 8b. Deferred / Out of Scope (current phase)

| Feature | Status |
|---|---|
| AFL / A-League / other sports | Post-NRL-traction (AFL first) |
| AI match predictions | Not planned |
| In-play 30-second polling | Post-launch (once pre-match stable) |
| iOS / Android native app | Post-PMF |
| API access tier | Post-launch |
| Pinnacle as reference line | Post-launch |

---

## 9. Remaining Pre-Launch Tasks

| Task | Priority | Status | Notes |
|---|---|---|---|
| CLV tracker (Pro) | High | ✅ Done | `closingOdds` on `BetLog`; CLV% on `/bets` |
| Bet ROI dashboard (Pro) | High | ✅ Done | P&L, ROI%, win rate, units, per-bookmaker table on `/bets` |
| Alert deduplication | High | ✅ Done | `AlertLog` table, per-type dedup windows |
| Trial email sequence | High | ✅ Done | Day 1/3/6; deduped via AppConfig |
| Game-day digest cron | High | ✅ Done | `/api/cron/digest` — 9am AEST on NRL days |
| Weekly performance summary cron | High | ✅ Done | `/api/cron/weekly-summary` — Monday 9am |
| Referral program | Medium | ✅ Done | AppConfig-based; 2 weeks free for both |
| Bookmaker balance tracker | Medium | ✅ Done | Cookie-based; arb stakes scale to balances |
| Upgrade interstitial | Medium | ✅ Done | 2.5s branded page on bookmaker redirect for free users |
| NRL team SEO pages | Medium | ✅ Done | 18 teams, `generateMetadata`, sitemap, robots |
| Favourite team pin | Low | ✅ Done | Cookie-based star; sorts fav team to top |
| Terms of Service | Medium | ❌ Needed | AU SaaS template; link from footer + register page |
| Privacy Policy | Medium | ❌ Needed | Australian Privacy Act 1988 (APPs) |
| Analytics (Posthog) | Medium | ❌ Needed | One script tag — biggest current blind spot |
| OG image | Medium | ❌ Needed | 1200×630 for social share cards |
| `icon-192.png` | Medium | ❌ Needed | Push notification icon broken |
| Sentry error monitoring | Low | ❌ Needed | `npm install @sentry/nextjs`; set `SENTRY_DSN` |
| Stripe webhook registration | Manual | ❌ Pending | Register domain in Stripe dashboard |
| Affiliate program signups | Manual | ❌ Pending | Sportsbet, Ladbrokes, Unibet, Betfair |
| Discord server setup | Manual | ❌ Pending | #free-alerts channel, webhook URL in Admin |
| Google Search Console | Manual | ❌ Pending | Verify domain, submit `sitemap.xml` |

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Free → Pro conversion rate | ≥ 5% of registered users within 30 days |
| Pro trial → paid conversion | ≥ 40% |
| Monthly Pro churn | ≤ 10% |
| Bookmaker affiliate CTR from best odds | ≥ 15% of sessions |
| Push notification opt-in rate | ≥ 30% of Pro subscribers |
| Odds board uptime during NRL match windows | ≥ 99% |
