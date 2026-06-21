-- Expand bookmaker enum to include all AU bookmakers available via The Odds API
-- Plus bet365 for the Playwright scraper

ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'ladbrokes';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'neds';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'pointsbet';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'unibet';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'betright';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'betr';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'betfair';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'tabtouch';
ALTER TYPE bookmaker ADD VALUE IF NOT EXISTS 'playup';
