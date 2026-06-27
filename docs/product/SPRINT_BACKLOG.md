# EdgeBoard — Sprint Backlog

**Last updated:** 2026-06-27
**Owner:** Troy Flavell (solo)

---

## Status Key
- ✅ Done
- 🟡 In progress / partial
- 🔴 Not started
- ⏳ Manual action required

---

## Completed

| Task | Notes |
|---|---|
| ✅ Core platform | Supabase, Prisma, env vars |
| ✅ Auth — Google OAuth | `redirectTo` passes through OAuth callback correctly |
| ✅ Auth — email/password | Login + register pages live |
| ✅ Protected route middleware | All app routes require auth |
| ✅ Stripe products | Monthly $19 AUD (`prod_UmPgHfxCcttzyp`), Annual $99 AUD (`prod_UmPzL1Ez263ESU`) |
| ✅ Stripe checkout | `CheckoutButton` component, 7-day trial |
| ✅ Stripe webhooks | `checkout.session.completed`, `.updated`, `.deleted`, `invoice.payment_failed` |
| ✅ Billing portal | Settings → Manage Billing → Stripe portal |
| ✅ Paywall gate | Free users see upgrade CTA; Pro users see full content |
| ✅ Subscription helpers | `getSubscriptionStatus()`, `isSubscribed()` |
| ✅ Odds ingestion worker | BullMQ, Railway Sydney, adaptive polling |
| ✅ 11-bookmaker coverage | The Odds API + Bet365 Playwright scraper |
| ✅ Affiliate deep links | Admin sets tracking URL per bookmaker; click tracker |
| ✅ NRL odds board | Best price highlight, affiliate links, price alert bells |
| ✅ Arb finder | Live arbs, FOMO panel, share button, empty state |
| ✅ EV finder | EV table, Kelly calc, FOMO panel, share button |
| ✅ Line movement tracker | Multi-window comparison, steam flags |
| ✅ Market Brief | Daily digest page |
| ✅ Live markets | Matches < 2h from kickoff |
| ✅ Dashboard | Summary stats + quick links |
| ✅ Bet tracker | Log and view placed bets (`/bets`) |
| ✅ Free bet converter | Optimal hedge calculator |
| ✅ Price alerts | DB table, server actions, `PriceAlertButton`, poll-cycle check |
| ✅ Web push notifications | VAPID, browser permission, settings toggle |
| ✅ Email alerts | Resend API |
| ✅ SMS alerts | Twilio |
| ✅ Settings page | Alerts list, notification prefs, billing |
| ✅ Admin panel | Affiliate URLs, click stats, Stripe health, worker mode, Discord |
| ✅ Mobile navigation | Bottom tab bar (Odds/Arb/EV/Home) + More drawer |
| ✅ Home page | Free-first marketing page, pricing section, FAQ |
| ✅ Pricing page | Dynamic Stripe price fetch, Free vs Pro, annual upsell |

---

## In Progress / Up Next

### T1 — Alert deduplication
**Priority:** High — prevents alert spam, required before scaling notifications
**Effort:** 3 hours

**What to build:**
- `AlertLog` table: `userId`, `alertType`, `key` (deterministic hash of the event), `sentAt`
- Before any alert fires, check `AlertLog` for same `userId + alertType + key` within dedup window
- Dedup window: arbs = 15 min, EV/steam = 60 min, price alerts = fire once (already handled by `firedAt`)
- Worker cleans stale log rows on startup

**Acceptance criteria:**
- [ ] Same arb does not fire push + email + SMS more than once per 15-minute window
- [ ] Same EV bet does not re-alert within 60 minutes
- [ ] `AlertLog` table exists and is queried before each notification send

---

### T2 — CLV tracker
**Priority:** High — primary differentiator for Pro conversion
**Effort:** 1 day

**What to build:**
- Worker stores closing price: on each poll, if a match transitions from `upcoming` to `live` or `completed`, write the last-known price for each outcome to a `closing_odds` JSONB field on the `Match` row (or a separate `ClosingOdds` table)
- Extend `BetEntry` (in `/bets`): add `closingOdds` nullable Decimal field; auto-populate when match closes
- CLV% = `((placedOdds / closingOdds) − 1) × 100` — show on each `/bets` row
- Badge: positive CLV = green "+X.X% CLV", negative = red

**Acceptance criteria:**
- [ ] Worker records closing odds for each outcome when match status changes to live/completed
- [ ] `/bets` page shows CLV% for bets where closing odds are known
- [ ] CLV column hidden for bets on upcoming matches (no closing line yet)

---

### T3 — Bet ROI dashboard
**Priority:** High — drives daily engagement and justifies Pro
**Effort:** 1 day

**What to build:**
- Summary stats row at top of `/bets`: Total bets · Win rate · P&L ($ and units) · ROI% · Avg CLV%
- P&L is calculated from `BetEntry`: `(won ? (stake × (odds − 1)) : −stake)` summed
- Units = P&L / average stake
- Filter: All time / Last 30 days / This season
- Export to CSV button (server action generates CSV response)

**Acceptance criteria:**
- [ ] Summary stats are mathematically correct (spot-checked against manual calculation)
- [ ] Filters update stats without page reload
- [ ] CSV export downloads correctly

---

### T4 — Terms of Service (`/terms`)
**Priority:** Medium — required before scaling
**Effort:** 2 hours

Use an AU SaaS ToS template (iubenda or similar). Key clauses: no guarantee of odds accuracy, no liability for betting losses, subscription terms, cancellation.

**Acceptance criteria:**
- [ ] `/terms` page live
- [ ] Linked from footer
- [ ] Linked from register page with checkbox

---

### T5 — Privacy Policy (`/privacy`)
**Priority:** Medium — Australian Privacy Act 1988 (APPs) requirement
**Effort:** 1 hour

Generate via iubenda. Covers: email collection, Stripe as payment processor, Supabase as data processor, user rights.

**Acceptance criteria:**
- [ ] `/privacy` page live
- [ ] Linked from footer

---

### T6 — Sentry error monitoring
**Priority:** Medium — needed before scaling users
**Effort:** 2 hours

`npm install @sentry/nextjs`, run wizard, set `SENTRY_DSN` in Vercel + Railway.

**Acceptance criteria:**
- [ ] Thrown API route error appears in Sentry
- [ ] Worker failures captured
- [ ] Source maps uploaded

---

### T7 — Plausible analytics
**Priority:** Low
**Effort:** 1 hour

Add Plausible script tag. Track: `arb_click`, `ev_click`, `best_odds_click`, `checkout_started`.

**Acceptance criteria:**
- [ ] Page views visible in Plausible dashboard
- [ ] 4 custom events firing

---

## Manual Actions Required

| Action | Notes |
|---|---|
| ⏳ Register Stripe webhook | Dashboard → Webhooks → `yourdomain.com/api/webhooks/stripe`; events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` |
| ⏳ Sportsbet affiliate signup | Paste tracking URL in Admin → Affiliate Links |
| ⏳ Ladbrokes affiliate signup | Paste tracking URL in Admin |
| ⏳ Unibet affiliate signup | Paste tracking URL in Admin |
| ⏳ Betfair affiliate signup | Paste tracking URL in Admin |
| ⏳ Create Discord server | Add #free-alerts channel; paste webhook URL in Admin → Discord |
| ⏳ Post launch announcement | r/NRL, r/sportsbetting, NRL Twitter/X |

---

## Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Arbs rare in NRL — Pro hard to justify on arbs alone | Confirmed | Pro pitch shifted to alerts (price targets, EV, steam) + CLV/ROI dashboard |
| Alert spam erodes push notification opt-in | High if unaddressed | T1 (deduplication) — build before any marketing push |
| Bet365 scraper blocked (non-AU IP) | Medium | Worker on Railway Sydney; confirm after next deploy |
| The Odds API quota | Low | Monitor usage in API dashboard; $8 USD/month Standard tier if needed |
