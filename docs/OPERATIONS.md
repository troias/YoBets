# EdgeBoard — Operations Guide

> **Who this is for:** You (Troy). Everything you need to run, configure, and grow EdgeBoard without touching code.

---

## Table of Contents

1. [Admin Panel](#1-admin-panel)
2. [Environment Variables](#2-environment-variables)
3. [Affiliate Programs — your fastest path to revenue](#3-affiliate-programs)
4. [Discord Setup](#4-discord-setup)
5. [Stripe — Subscription Payments](#5-stripe)
6. [Launching — where to post and what to say](#6-launching)
7. [The Odds API](#7-the-odds-api)
8. [Worker — keeping odds fresh](#8-worker)
9. [Push Notifications (VAPID)](#9-push-notifications)
10. [Email Alerts (Resend)](#10-email-alerts)
11. [SMS Alerts (Twilio)](#11-sms-alerts)
12. [Revenue Roadmap](#12-revenue-roadmap)

---

## 1. Admin Panel

**URL:** `/admin` — only visible to `ADMIN_EMAIL` (your email).

| Section | What you do here |
|---|---|
| **Subscriber cards** | See active, trialing, and churned subs at a glance |
| **Stripe Health** | Green/red dots — if any are red, subscriptions are broken |
| **Affiliate Links** | Paste your tracking URLs per bookmaker — live instantly |
| **Worker Mode** | Production / Slow / Off — switch to Slow when dev, Off to pause |
| **App Config** | Paste API keys (The Odds API, Resend, Twilio, Discord, Stripe) |
| **API Keys** | Generate bearer tokens for the `/api/metrics` endpoint |

---

## 2. Environment Variables

Set these in `.env.local` for local dev, and in your hosting provider (Vercel / Railway) for production.

### Required to run at all

| Variable | What it is | Where to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Supabase → Project Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Same as above — keep secret |
| `ADMIN_EMAIL` | Your email — gates access to `/admin` | Set to `troyflavel@gmail.com` |

### Odds data

| Variable | What it is | Where to get it |
|---|---|---|
| `THE_ODDS_API_KEY` | Live NRL odds from 11 bookmakers | the-odds-api.com — free tier available |

### Subscriptions

| Variable | What it is | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe server-side key | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook payloads | Stripe Dashboard → Webhooks → signing secret |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Stripe Price ID for $19/month plan | Stripe Dashboard → Products → your price ID |
| `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` | Stripe Price ID for annual plan | Same |
| `SUBSCRIPTION_PRICE_AUD` | Used to calculate MRR in admin (e.g. `19`) | Set manually |

### Notifications

| Variable | What it is | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Email alerts (arbs, steam moves) | resend.com |
| `TWILIO_ACCOUNT_SID` | SMS alerts | twilio.com |
| `TWILIO_AUTH_TOKEN` | SMS alerts | twilio.com |
| `TWILIO_PHONE_NUMBER` | Your Twilio sending number | twilio.com |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser push notifications | Generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Browser push notifications (server-only) | Same command — keep secret |

### Misc

| Variable | What it is | Where to get it |
|---|---|---|
| `CRON_SECRET` | Protects `POST /api/cron` from unauthorized triggers | Make up any long random string |
| `NEXT_PUBLIC_APP_URL` | Your production URL (e.g. `https://edgeboard.com.au`) | Your domain |
| `REDIS_URL` | Only needed if running BullMQ worker separately | Railway Redis addon |

### Config stored in Admin (not env vars)

These live in the database and can be changed from `/admin` without a redeploy:

- `THE_ODDS_API_KEY` — can be set here instead of env
- `DISCORD_WEBHOOK_URL` — Discord channel webhook
- `affiliate_sportsbet`, `affiliate_tab`, etc. — your bookmaker tracking URLs
- `clicks_sportsbet`, `clicks_tab`, etc. — auto-incremented, read-only

---

## 3. Affiliate Programs

### How it works

Every "Bet →" button on the site sends the user to `/api/bet?bm=sportsbet`. That route:
1. Looks up `affiliate_sportsbet` in Admin config
2. If set → redirects to your affiliate tracking URL (your CPA/revenue share link)
3. If not set → redirects to the generic Sportsbet rugby-league page
4. Increments the click counter shown in Admin

You see the click counts in Admin → Affiliate Links. The bookmaker's own affiliate dashboard shows conversions (signups + deposits).

### Sign-up checklist

Work through these in order — Sportsbet and Ladbrokes have the largest user bases in Australia.

**Sportsbet**
- Program: Sportsbet Affiliates
- URL: https://affiliates.sportsbet.com.au
- Commission: CPA ~$120–180 AUD per depositing customer
- Approval time: 3–7 days

**Ladbrokes**
- Program: Income Access (used by Ladbrokes + Neds + others)
- URL: https://www.ladbrokesaffiliates.com.au
- Note: one application covers both Ladbrokes and Neds
- Commission: CPA or revenue share

**Unibet**
- Program: Kindred Affiliates (global program, AU supported)
- URL: https://www.kindredaffiliates.com
- Commission: revenue share 20–30% of net losses

**Betfair**
- Program: Betfair Affiliates AU
- URL: https://affiliates.betfair.com.au
- Note: Betfair is an exchange, not a bookmaker — users who exchange bet bring recurring revenue share

**PointsBet**
- URL: https://affiliates.pointsbet.com.au

**TAB**
- URL: https://www.tab.com.au/affiliates (check for current program)

**Betr / BetRight / PlayUp / TABtouch**
- Smaller books — sign up after the big ones are live

### Pasting your tracking URL

1. Get approved and generate your tracking link (looks like `https://record.sportsbet.com.au/?aid=12345&c=nrl-odds`)
2. Go to Admin → Affiliate Links
3. Paste the link in the input next to the bookmaker
4. Click Save — goes live immediately, no redeploy

---

## 4. Discord Setup

### What you're building

- A free Discord server for your community
- A `#free-alerts` channel that the app posts to automatically after every odds poll
- Alerts include: arb opportunities found, EV bets, steam moves

### Step by step

**1. Create the server**
- discord.com → + (add server) → Create My Own → For a club or community
- Name it: `EdgeBoard` or `NRL Sharp Betting` or similar

**2. Create channels**
- `#welcome` — pin your site link and a short intro
- `#free-alerts` — the app posts here automatically
- `#arb-alerts` — optional, dedicated arb channel
- `#general` — community chat

**3. Get the webhook URL**
- Right-click on `#free-alerts` → Edit Channel → Integrations → Webhooks → New Webhook
- Name it `EdgeBoard Bot`, copy the webhook URL

**4. Paste into Admin**
- Admin → App Config → Discord → Webhook URL → paste → Save
- The worker will post to this channel after the next poll cycle

### What gets posted

After each poll, the worker posts a Discord embed with:
- Number of odds updated
- Any arb opportunities found (match, ROI%)
- Next poll time

### Discord strategy

- Keep `#free-alerts` open to everyone (free users see the signal, want the full tool)
- Use it as a funnel: "see something you like? Full arb finder + EV + line movement at edgeboard.com.au"
- Don't gate the Discord — the website is the paid product

---

## 5. Stripe

### Setup checklist

1. **Create a Stripe account** at stripe.com
2. **Create a product**: Dashboard → Products → Add Product → name it "EdgeBoard Pro"
3. **Add a price**: $19.00 AUD / month recurring
4. **Copy the Price ID** (starts with `price_`) — this goes in `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`
5. **Copy API keys**: Dashboard → Developers → API Keys
   - Publishable key: starts with `pk_live_` (put in `STRIPE_PUBLISHABLE_KEY` in admin)
   - Secret key: starts with `sk_live_` (put in `STRIPE_SECRET_KEY` in admin)
6. **Set up webhook**: Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in admin

### Test it

Go to `/settings` as a logged-in user, click "Go Pro →". If Stripe is configured, it opens the Stripe checkout. Use test card `4242 4242 4242 4242` in test mode.

### Check health

Admin → Stripe Health — all 4 dots should be green before launch.

---

## 6. Launching

### Where to post

| Community | Link | What to say |
|---|---|---|
| r/NRL | reddit.com/r/NRL | Lead with value, not promo |
| r/sportsbetting | reddit.com/r/sportsbetting | Explain the arb finder — people love this |
| NRL Twitter/X | Search `#NRL` `#NRLbetting` | Short + punchy, screenshot the arb finder |
| Facebook NRL groups | Search "NRL tips" on Facebook | More casual audience, great for reach |
| Punters Lounge forum | puntersonline.com.au | Serious AU bettors |

### What to post (example)

> Built a free NRL odds comparison tool that finds arbitrage opportunities across 11 Australian bookmakers in real time.
>
> Shows best available odds, flags when books disagree by >8%, and has an EV finder with no-vig fair pricing.
>
> Free to use — just sign up. Link: [your URL]

**Tips:**
- Screenshot the arb finder showing a real opportunity — visual proof beats a description
- Post during Thursday night / Sunday afternoon (pre-game buzz, people are checking odds)
- Don't use "guaranteed profit" language — Reddit mods will remove it. Say "risk-free returns" or "price inefficiencies"

### What you need before posting

- [ ] Domain is live (not localhost)
- [ ] Sign-up works end-to-end
- [ ] At least one round of NRL odds loaded (worker has run once)
- [ ] Discord is live so you can link to it in comments

---

## 7. The Odds API

**Site:** the-odds-api.com

**What it provides:** Live NRL odds from Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch, PlayUp.

### Costs

| Plan | Requests/month | Monthly cost |
|---|---|---|
| Free | 500 | $0 |
| Starter | 30,000 | ~$49 USD |
| Standard | 100,000 | ~$99 USD |

Each poll cycle consumes approximately 3–6 API requests (one per market type × bookmaker batch).

At 30-second polling intervals: ~2 requests/minute × 60 × 24 × 30 = ~86,400 requests/month → Standard plan.

At 2-minute intervals (current default): ~21,600 requests/month → Starter plan.

### Configuring the key

Admin → App Config → The Odds API → paste key → Save.

---

## 8. Worker

The worker polls bookmakers and writes odds to the database.

### Modes (set in Admin → Worker Mode)

| Mode | Poll intervals | Use when |
|---|---|---|
| **Production** | 2/5/15/60 min based on match proximity | Always, in production |
| **Slow / Dev** | 12/30/90 min / 6h | Local dev, or to save API quota |
| **Off** | Pauses for 24h, then re-checks | Maintenance, or if API quota runs out |

### Running the worker

**On Railway (recommended):**
- Deploy as a separate service pointing to `src/workers/odds-ingestion-worker.ts`
- Set all the same env vars as the main Next.js app
- Set `REDIS_URL` to a Railway Redis addon

**Via cron (simpler, no Redis needed):**
- Point cron-job.org (free) at `POST https://yourdomain.com/api/cron`
- Header: `Authorization: Bearer YOUR_CRON_SECRET`
- Interval: every 2 minutes
- This triggers a single poll cycle on each hit

**Manual trigger:**
- Admin → Worker Mode → Trigger Now button

---

## 8b. Cron Jobs — Emails & Digests

There are three additional cron endpoints beyond the main odds-polling worker. All require the `x-cron-secret` header (same `CRON_SECRET` env var).

### Endpoints

| Endpoint | Purpose | Recommended schedule |
|---|---|---|
| `POST /api/cron/digest` | Game-day digest — 9am email with best NRL bets, only fires when there are games today | `0 23 * * *` (23:00 UTC = 09:00 AEST) |
| `POST /api/cron/weekly-summary` | Monday morning P&L summary for users with settled bets in the last 7 days | `0 23 * * 0` (23:00 UTC Sunday = 09:00 AEST Monday) |
| `POST /api/cron/trial-emails` | Trial sequence — Day 1/3/6 onboarding emails to trialing users | `0 23 * * *` (daily, same time as digest) |
| `POST /api/digest` | Legacy user-specific digest (fires at each user's chosen time) | Every minute (already wired) |

### cron-job.org setup (free, 3 jobs needed)

1. Go to [cron-job.org](https://cron-job.org) → Create cronjob
2. **URL:** `https://yourdomain.com/api/cron/digest`
3. **Schedule:** custom — `0 23 * * *`
4. **Headers:** `x-cron-secret: YOUR_CRON_SECRET`
5. Repeat for `/api/cron/weekly-summary` (schedule: `0 23 * * 0`) and `/api/cron/trial-emails` (schedule: `0 23 * * *`)

> Tip: all three daily jobs can share the same 23:00 UTC schedule. cron-job.org runs them in parallel — no conflict.

### Vercel cron (if hosting on Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/digest",          "schedule": "0 23 * * *" },
    { "path": "/api/cron/weekly-summary",  "schedule": "0 23 * * 0" },
    { "path": "/api/cron/trial-emails",    "schedule": "0 23 * * *" }
  ]
}
```

Vercel cron calls with `GET` not `POST` and doesn't support custom headers — wrap with a `GET` handler that checks `CRON_SECRET` via query param or use cron-job.org instead.

### Railway cron (if hosting on Railway)

In your Railway project, add a Cron service:
- **Command:** `curl -s -X POST https://yourdomain.com/api/cron/digest -H "x-cron-secret: $CRON_SECRET"`
- **Schedule:** `0 23 * * *`

Duplicate for weekly-summary and trial-emails.

### Testing manually

```bash
curl -X POST https://yourdomain.com/api/cron/digest \
  -H "x-cron-secret: YOUR_CRON_SECRET"

curl -X POST https://yourdomain.com/api/cron/weekly-summary \
  -H "x-cron-secret: YOUR_CRON_SECRET"

curl -X POST https://yourdomain.com/api/cron/trial-emails \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## 9. Push Notifications

Browser push alerts for arbs, steam moves, etc.

### Generate VAPID keys (one-time setup)

```bash
npx web-push generate-vapid-keys
```

Copy the output:
- `Public Key` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` and hosting env
- `Private Key` → `VAPID_PRIVATE_KEY` in `.env.local` and hosting env (keep secret)

These never change — generate once, store both somewhere safe.

---

## 10. Email Alerts

Uses **Resend** to send arb and steam-move alerts to users who enable them.

1. Sign up at resend.com (free tier: 3,000 emails/month)
2. Create an API key
3. Admin → App Config → Resend → paste key → Save
4. Verify your sending domain in Resend dashboard (or use `onboarding@resend.dev` for testing)

---

## 11. SMS Alerts

Uses **Twilio** for SMS arb alerts (premium feature).

1. Sign up at twilio.com
2. Get a trial number (free), or buy an AU number (~$2/month)
3. Copy Account SID, Auth Token, and phone number
4. Admin → App Config → Twilio → paste each value → Save

---

## 12. Revenue Roadmap

| Milestone | Monthly revenue | What unlocks it |
|---|---|---|
| 1 affiliate conversion | $120–200 AUD one-off | First "Bet →" click that converts |
| 3 paying subscribers | ~$57 AUD/month | Stripe configured + users on site |
| 8 paying subscribers | ~$152 AUD/month | Covers OddsJam Bet365 API — remove stale data warning |
| 15 paying subscribers | ~$285 AUD/month | Covers all running costs + profit |
| 20 subscribers + affiliate revenue | $500+ AUD/month | Scale marketing, add more sports |

### What to do first (today)

1. Apply to Sportsbet and Ladbrokes affiliate programs (10 min each)
2. Create Discord server + paste webhook URL into Admin
3. Confirm Stripe health is green in Admin
4. Make sure the worker has run at least once (trigger manually in Admin if needed)
5. Post in r/NRL and r/sportsbetting once you have real odds data showing
