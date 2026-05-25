-- EdgeBoard bootstrap schema is Prisma-managed.
-- This migration provides Supabase-specific tuning and real-time publication setup.

create extension if not exists pgcrypto;

alter database postgres set timezone to 'Australia/Sydney';

-- Realtime publication examples for high-frequency entities
create publication edgeboard_realtime;
alter publication edgeboard_realtime add table "OddsSnapshot";
alter publication edgeboard_realtime add table "LineMovement";
alter publication edgeboard_realtime add table "Alert";

-- Recommended indexes for query hotspots (must match Prisma names if created by Prisma)
create index if not exists idx_odds_snapshot_event_market_time on "OddsSnapshot" ("eventId", "marketId", "sourceCapturedAt" desc);
create index if not exists idx_line_movement_event_time on "LineMovement" ("eventId", "sourceTime" desc);
create index if not exists idx_ev_opportunity_value_score on "EVOpportunity" ("valueScore" desc, "expectedValuePct" desc);
