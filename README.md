# EdgeBoard — Australian Sports Betting Market Intelligence

EdgeBoard is a production-grade odds intelligence platform focused on the Australian market (NRL-first), built as a premium SaaS analytics terminal.

## Stack

- Next.js App Router + TypeScript + TailwindCSS
- Supabase (Auth, Postgres, Realtime, Storage)
- Prisma ORM
- Zustand + TanStack Query + TanStack Table
- Recharts
- BullMQ + Redis worker services
- Playwright sportsbook adapters

## Product Scope

EdgeBoard is **not** a picks platform. It provides:
- Odds aggregation
- EV analytics
- Arbitrage detection
- Line movement intelligence
- NRL and Bet365 market intelligence tooling

## Key Pages

- `/login`, `/register`, `/dashboard`, `/live`, `/ev`, `/arbitrage`
- `/markets/[id]`, `/sportsbooks`, `/settings`, `/admin`, `/nrl`

## Local Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

## Architecture Highlights

- Feature-based app modules under `src/features`
- Shared services in `src/lib`
- Worker/scraper architecture in `src/workers`
- Domain data model in Prisma (`/prisma/schema.prisma`)
- Supabase bootstrap SQL in `supabase/migrations/0001_init.sql`

## Deployment Strategy

1. Host web app on Vercel/Fly.io
2. Host worker service separately (Railway/Fly.io/ECS)
3. Use managed Redis (Upstash/Elasticache)
4. Use Supabase for DB/Auth/Realtime
5. Add CDN + edge caching for high-frequency API reads

## Security Baseline

- Zod input validation for API routes
- Environment validation via schema parsing
- Minimal rate limiting middleware for public routes
- Role/tier-based feature gating helpers
- Server-only secrets via `.env`

## Implementation Roadmap

1. Foundation: auth, schema, adapters, queues
2. Ingestion: bookmaker adapters + normalization
3. Intelligence: EV, arbitrage, steam moves, disagreement maps
4. UX: terminal-grade dashboard + mobile quick actions
5. Premium: Bet365 hunter mode, CLV analytics, personal edge scoring
6. Scale: historical warehousing, model-driven movement predictions
