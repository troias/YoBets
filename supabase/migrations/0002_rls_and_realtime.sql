-- RLS: public read, service role writes only
-- Realtime: odds table only (matches change rarely — no need to broadcast)

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read matches"
  ON matches FOR SELECT TO anon USING (true);

CREATE POLICY "public read odds"
  ON odds FOR SELECT TO anon USING (true);

-- Service role bypasses RLS by default — no write policy needed.

ALTER PUBLICATION supabase_realtime ADD TABLE odds;
