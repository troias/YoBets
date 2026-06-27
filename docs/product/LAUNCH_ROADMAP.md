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
| P3 — Authentication | ✅ Complete | Google OAuth + email/password; onboarding wizard; referral tracking |
| P4 — Subscription System | ✅ Complete | Stripe Checkout, webhook handler, billing portal, paywall gate |
| P5 — Odds Ingestion | ✅ Complete | 11 bookmakers, BullMQ worker, adaptive polling, Railway deployed |
| P6 — Intelligence Engine | ✅ Complete | Arb finder, EV finder, line movement, market brief, steam detection |
| P7 — Frontend | ✅ Complete | All pages live; mobile layouts; SEO team pages; public /nrl |
| P8 — Notifications | ✅ Complete | Web Push, email (Resend), SMS (Twilio), price alerts; trial + digest + weekly crons |
| P9 — Pro Additions | ✅ Complete | CLV tracker, ROI dashboard, alert deduplication all live |
| P10 — Compliance | 🟡 Partial | Responsible gambling footer ✅ — ToS + Privacy Policy pages still needed |
| P11 — Operations | 🔴 Not started | Sentry, analytics (Posthog), uptime monitor |
| P12 — Affiliate | 🟡 Partial | Admin UI + click tracker + interstitial done; affiliate program signups pending |

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
- **NRL odds board** (`/nrl`): 11 bookmakers, H2H/line/total markets, best price highlighted, affiliate links, price alert bells, publicly accessible (no auth required), favourite team pin, mobile card layout
- **NRL team SEO pages** (`/nrl/[team]`): 18 team pages with full odds table, `generateMetadata`, indexed in sitemap
- **Arb finder** (`/arbitrage`): Live arbs, missed arb panel, near-miss panel, FOMO panel, Twitter share, upgrade CTA, bookmaker-balance-aware stake scaling, kickoff countdown
- **EV finder** (`/ev`): EV table, Kelly calculator, FOMO panel, Twitter share, upgrade nudge, mobile card layout
- **Line movement** (`/line-movement`): Multi-window comparison, steam move flags, upgrade nudge, mobile card layout
- **Market Brief** (`/brief`): Daily digest
- **Live markets** (`/live`): Matches < 2h from kickoff
- **Dashboard** (`/dashboard`): Summary stats, ghost alerts panel for free users, "what changed" panel
- **Bet tracker** (`/bets`): Log bets, P&L, ROI%, win rate, units, CLV%, per-bookmaker breakdown
- **Free bet converter** (`/free-bet-converter`)
- **Settings** (`/settings`): Active price alerts, notification prefs, billing, bookmaker balance tracker, referral link
- **Admin** (`/admin`): Affiliate URLs, click stats, Stripe health, worker mode, Discord
- **Home page** (`/`): Free-first marketing page with pricing section, FAQ, feature showcase
- **Pricing page** (`/pricing`): Dynamic Stripe price fetch, live urgency stats, ghost notification example, Free vs Pro cards, annual upsell
- **Onboarding** (`/onboarding`): 2-step wizard (bookmaker select + bankroll) for new users
- **Notifications** (`/notifications`): Pro alert history — 30-day log with type badges and AEST timestamps
- **About** (`/about`): Origin story, how-it-works, bookmakers list, affiliate + responsible gambling transparency
- **Sitemap** (`/sitemap.xml`) + **robots** (`/robots.txt`): All static + team SEO pages included

### Notifications (P8) ✅
- Web Push (VAPID): push subscription stored, toggle in settings
- Email: Resend API
- SMS: Twilio
- Alert types: price target, EV bet, steam move, arb open
- `checkPriceAlerts()` called on every poll cycle
- `PriceAlertButton` component inline on NRL board for logged-in users
- Alert history tracked with `firedAt` timestamp — each alert fires once
- **Game-day digest** (`/api/cron/digest`): 9am AEST email on NRL days — top 5 EV bets + live arb count — to all Pro users with digest preference
- **Weekly performance summary** (`/api/cron/weekly-summary`): Monday 9am — P&L, ROI, win rate, per-bookmaker breakdown — sent to users with settled bets that week
- **Trial email sequence** (`/api/cron/trial-emails`): Day 1 (onboarding tips), Day 3 (push nudge), Day 6 (last chance) — deduped via AppConfig

### Pro Additions (P9) ✅
- **CLV tracker**: `closingOdds` field on `BetLog`; CLV% shown per bet on `/bets`
- **Bet ROI dashboard**: summary row (P&L, ROI%, win rate, units) + per-bookmaker breakdown table on `/bets`
- **Alert deduplication**: `AlertLog` table with per-type dedup windows; `pruneOldAlertLogs()` on worker startup; no duplicate alerts within window

---

## Remaining Work

### P9 — Pro Additions ✅ COMPLETE

All shipped:
- ✅ CLV tracker — `closingOdds` on `BetLog`, CLV% on `/bets`
- ✅ Bet ROI dashboard — P&L, ROI%, win rate, units, per-bookmaker table on `/bets`
- ✅ Alert deduplication — `AlertLog` table, per-type dedup windows, prune on startup

---

### P10 — Compliance 🟡 Partial

| Task | Status | Notes |
|---|---|---|
| Responsible gambling footer | ✅ Done | In app-shell on all authenticated pages; Gambling Help Online 1800 858 858 |
| Affiliate disclosure | ✅ Done | Footer note + About page transparency section |
| Terms of Service (`/terms`) | ❌ Needed | AU SaaS template; link from footer + register page |
| Privacy Policy (`/privacy`) | ❌ Needed | Australian Privacy Act 1988 (APPs); covers email, Stripe, Supabase |

---

### P11 — Operations 🔴 Not started

| Task | Status | Notes |
|---|---|---|
| Posthog / analytics | ❌ Needed | Biggest blind spot — no funnel or feature usage data |
| OG image (`/opengraph-image.png`) | ❌ Needed | Social shares show blank card without this |
| `icon-192.png` | ❌ Needed | Referenced in `sw.js` but file missing — push notifications show broken icon |
| Sentry error monitoring | ❌ Needed | `npm install @sentry/nextjs`; set `SENTRY_DSN` in Vercel + Railway |
| Uptime monitor | ❌ Needed | UptimeRobot free tier; alert on `/api/cron` down > 2 min |

---

### P12 — Affiliate & Distribution 🟡 Partial

| Task | Status | Notes |
|---|---|---|
| Admin UI for affiliate URLs | ✅ Done | Built |
| Affiliate click tracker + interstitial | ✅ Done | `/api/bet` logs clicks; free users see upgrade interstitial |
| Sportsbet affiliate signup | ❌ Manual | ~10 min; $150–250 AUD per new depositor |
| Ladbrokes affiliate signup | ❌ Manual | ~10 min; similar payout |
| Unibet affiliate signup | ❌ Manual | |
| Betfair affiliate signup | ❌ Manual | |
| Discord server + #free-alerts channel | ❌ Manual | Highest-retention community mechanism |
| Stripe webhook registration in dashboard | ❌ Manual | Register `yourdomain.com/api/webhooks/stripe` |
| Google Search Console verification | ❌ Manual | Submit sitemap; monitor `/nrl/[team]` indexing |
| Re-engagement email cron | ❌ To build | 7-day cold users → "here's what you missed" |
| `trial_will_end` webhook email | ❌ To build | Stripe fires 3 days before trial ends |
| `invoice.payment_failed` email | ❌ To build | Webhook exists but sends no email to user |
| Win-back email (trial expired, no payment) | ❌ To build | 48h after trial lapses without converting |

---

## Post-Launch Roadmap

### Month 1 — Fix the gaps, get first users
- ✅ CLV tracker live
- ✅ Bet ROI dashboard live
- ✅ Alert deduplication live
- ✅ Onboarding wizard for new users
- ✅ Mobile layouts (NRL, EV, line movement)
- ✅ /nrl publicly accessible for SEO
- ✅ NRL team SEO pages + sitemap + robots.txt
- ✅ Game-day digest email cron
- ✅ Weekly performance summary email cron
- ✅ Trial email sequence (Day 1/3/6)
- ✅ Bookmaker balance tracker
- ✅ Referral program
- ✅ Upgrade interstitial on bookmaker redirect
- ✅ About page + notifications history page
- ❌ Compliance pages (ToS, Privacy Policy)
- ❌ Analytics (Posthog)
- ❌ Fix icon-192.png (push notification broken icon)
- ❌ Add OG image for social sharing
- ❌ Apply to Sportsbet + Ladbrokes affiliate programs
- ❌ Post in r/NRL + r/sportsbetting on first Thursday night game

### Month 2 — Retention infrastructure
- ❌ Re-engagement email cron (cold users 7+ days)
- ❌ `trial_will_end` webhook → email 3 days before trial ends
- ❌ `invoice.payment_failed` → email user to update card
- ❌ Win-back email for expired non-converters
- ❌ Discord community live (#free-alerts channel)
- ❌ Shareable P&L card on /bets
- ❌ Direct Sportsbet + TAB scrapers (reduce Odds API cost)

### Month 3 — AFL expansion
- AFL odds board (`/afl`) — same 11 bookmakers, same arb/EV/line-movement engine
- AFL team SEO pages (`/afl/[team]` — 18 clubs)
- Game-day digest + weekly summary updated for AFL
- Sitemap updated

**Why AFL first:** same bookmakers, same infrastructure, same bettor demographic. AFL is bigger than NRL nationally. Season March–September overlaps NRL, creating a near-year-round product. Doubles the addressable market for ~3–5 days of engineering work.

### Month 4–6 — Close the offseason gap
- BBL cricket (December–February) — fills the NRL/AFL offseason
- A-League soccer (October–May)
- 3 sports = 12 months of active product = near-zero seasonal churn

### Month 6–12 — Scale
- Pinnacle odds as reference line (sharper fair value model)
- Mobile app (React Native — shares all API routes)
- API access tier for power users / syndicates
- Horse racing (largest AU betting market by volume — significant effort)

---

## The ceiling

OddsJam (same model, US market) sold for ~$120M USD. They got there by covering all major US sports at scale with a team.

| Scenario | MRR | Est. exit value |
|---|---|---|
| NRL only, 100 subscribers + affiliate | ~$5,000/month | $120k–$250k AUD |
| NRL + AFL, 250 subscribers + affiliate | ~$10,000/month | $300k–$500k AUD |
| NRL + AFL + cricket + soccer, 500+ subscribers | ~$20,000+/month | $1M–$3M AUD |
| Full AU sports platform + mobile + API | Scale | $10M–$30M+ AUD |

The infrastructure is already sport-agnostic. Distribution and sport coverage are the only constraints.
