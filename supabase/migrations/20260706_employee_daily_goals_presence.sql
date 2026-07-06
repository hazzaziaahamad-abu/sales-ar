-- Employee daily KPI goals (set by each rep, visible to managers)
CREATE TABLE IF NOT EXISTS employee_daily_goals (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      TEXT        NOT NULL,
  rep_name    TEXT        NOT NULL,
  sales_type  TEXT        NOT NULL,
  goal_date   DATE        NOT NULL,
  goal_count  INTEGER     NOT NULL DEFAULT 3,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, rep_name, sales_type, goal_date)
);

-- User presence: tracks online status + day start time
CREATE TABLE IF NOT EXISTS user_presence (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         TEXT        NOT NULL,
  user_name      TEXT        NOT NULL,
  presence_date  DATE        NOT NULL,
  first_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_name, presence_date)
);

-- RLS: open read/write within org (auth is handled app-side)
ALTER TABLE employee_daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_all"    ON employee_daily_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "presence_all" ON user_presence         FOR ALL USING (true) WITH CHECK (true);

-- Helper: insert-or-update presence preserving first_seen_at
CREATE OR REPLACE FUNCTION upsert_user_presence(
  p_org_id       TEXT,
  p_user_name    TEXT,
  p_date         DATE,
  p_now          TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (org_id, user_name, presence_date, first_seen_at, last_seen_at)
  VALUES (p_org_id, p_user_name, p_date, p_now, p_now)
  ON CONFLICT (org_id, user_name, presence_date)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
