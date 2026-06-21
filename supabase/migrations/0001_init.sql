-- EdgeBoard MVP schema
-- Tables: matches, odds
-- All arb/EV/best-odds computation happens at read time — nothing stored.

-- Enums
CREATE TYPE match_status AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE bookmaker    AS ENUM ('sportsbet', 'tab', 'bet365');
CREATE TYPE market_type  AS ENUM ('h2h', 'line', 'total');
CREATE TYPE outcome      AS ENUM ('home', 'away', 'draw', 'over', 'under');

-- matches: NRL fixture — who plays who and when
CREATE TABLE matches (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team     TEXT         NOT NULL,
  away_team     TEXT         NOT NULL,
  kickoff_at    TIMESTAMPTZ  NOT NULL,
  round         INTEGER      NOT NULL,
  season        INTEGER      NOT NULL,
  status        match_status NOT NULL DEFAULT 'upcoming',
  sportsbet_id  TEXT         UNIQUE,
  tab_id        TEXT         UNIQUE,
  bet365_id     TEXT         UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- odds: current price per bookmaker/market/outcome — upserted every poll cycle
CREATE TABLE odds (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID         NOT NULL REFERENCES matches(id),
  bookmaker     bookmaker    NOT NULL,
  market_type   market_type  NOT NULL,
  outcome       outcome      NOT NULL,
  price         NUMERIC(6,2) NOT NULL,
  line_value    NUMERIC(5,1),
  deep_link_url TEXT         NOT NULL,
  updated_at    TIMESTAMPTZ  NOT NULL,

  CONSTRAINT odds_unique UNIQUE (match_id, bookmaker, market_type, outcome)
);

-- Indexes
CREATE INDEX idx_odds_match_id   ON odds (match_id);
CREATE INDEX idx_odds_updated_at ON odds (updated_at);
CREATE INDEX idx_matches_kickoff ON matches (kickoff_at) WHERE status != 'completed';
