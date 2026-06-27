# EdgeBoard — Gaps & To-Do

> Ranked by revenue/growth impact. Do the top ones first.
> Created 2026-06-27.

---

## 🔴 Critical — fix before heavy marketing

- [ ] **Add Posthog analytics** — install Posthog (free tier). One script tag in `layout.tsx`. Without this you're blind: no funnel data, no feature usage, no drop-off points, can't improve what you can't measure.

- [ ] **Fix missing `icon-192.png`** — referenced in `public/sw.js` for push notifications but file doesn't exist. Every push notification shows a broken icon. Add a 192×192 PNG to `/public/icon-192.png`.

- [ ] **Apply to Sportsbet + Ladbrokes affiliate programs** — $100–250 AUD per new depositing customer. This will outpace subscription revenue in year 1. Takes 10 min to apply each. Ladbrokes: partners.ladbrokes.com.au. Sportsbet: their affiliate program page.

- [ ] **Add OG image** — `public/` has no `opengraph-image.png`. Social shares on Twitter/Discord/Reddit show a blank card. Create a 1200×630 dark branded image (EdgeBoard logo, "NRL odds · arbs · EV across 11 bookmakers"). Add to `/public/opengraph-image.png` and wire in `layout.tsx` metadata.

---

## 🟠 High — do within the first week of users

- [ ] **Re-engagement email cron** — users who haven't visited in 7 days get nothing. Build a cron that finds cold users and sends "2 arbs opened this week while you were away — here's what you missed" with real data from `alert_log`.

- [ ] **`trial_will_end` webhook** — Stripe fires this 3 days before trial expires. Wire it in `webhooks/stripe/route.ts` → send a "your trial ends in 3 days, here's what you'll lose" email. Currently zero touchpoint at this critical moment.

- [ ] **`invoice.payment_failed` webhook** — Pro users whose card declines get silently downgraded. Wire the Stripe event → send "your payment failed, update your card here" email with a direct link to `/api/billing-portal`.

- [ ] **Social proof on pricing + landing** — add a live stat: "X arbs found this week" or "X bets tracked" pulled from the DB. Even small numbers beat zero. Builds trust for cold visitors.

---

## 🟡 Growth — high leverage when you have users

- [ ] **Shareable P&L card** — "Share my week" button on `/bets` that generates a card image: dark background, EdgeBoard logo, "+$247 this week · 8.3% ROI · 12 bets". Post to Twitter. Free viral loop — every share is an ad.

- [ ] **Discord community** — mentioned in social posts but not created. Community is the highest-retention mechanism available. Users in a Discord churn 5–10x less. Create it, pin the invite in the app sidebar and in every email.

- [ ] **Win-back email for trial-expired non-converters** — when `subscription.status` goes from `trialing` → `canceled` with no payment, wait 48h then send a single "still thinking?" email with a direct checkout link. One email, no drip.

- [ ] **Dunning email sequence** — card declines move sub to `past_due`. Currently nothing happens in app. Send day 1, day 4, day 7 emails with escalating urgency before cancellation.

---

## 🟢 Expansion — do after you have traction

- [ ] **AFL** — same bookmakers, same API infrastructure, doubles the market. AFL season March–September overlaps and complements NRL. Biggest single move to increase ceiling.

- [ ] **NRL offseason retention** — BBL cricket (December–February) or NBA keeps users engaged when there's no NRL. Even basic odds comparison for one sport is enough to prevent churn.

- [ ] **"Share my arb" image generator** — when an arb is found, a one-click button generates a card: "+1.8% guaranteed on Panthers vs Broncos · Sportsbet + TAB". Shareable on social. Every share drives curiosity.

- [ ] **Google Search Console** — verify the domain, submit `sitemap.xml`. The `/nrl/[team]` SEO pages need to be indexed. Without GSC you won't know if Google is crawling them.

- [ ] **Horse racing** — biggest betting market in Australia by dollar volume, but technically more complex (many markets, fluctuating fields). Longer-term play.

---

## 📝 Notes

- OddsJam (US) sold for ~$120M — covers all major US sports at scale. That's the ceiling for what this category can become in Australia if AFL + cricket + broad sports are added and the user base compounds.
- The Australian sports betting market is ~$3B AUD annually. Even 0.1% of active bettors as paying subscribers = 3,000 users × $19 = $57,000/month.
- The tech is already more complete than most tools at this stage. Distribution is the constraint now, not features.
- Affiliate revenue from Sportsbet/Ladbrokes can realistically fund the business before subscription revenue scales. Prioritise getting approved.
