-- Scheduled / routine tasks for the AI agent.
-- A task = WHO (audience) + WHAT (message + optional generated image/link) +
-- WHEN (schedule) + CHANNEL (whatsapp). All access is via the service-role
-- client (src/lib/supabase/admin.ts), scoped by org_id in application code.

-- ----------------------------------------------------------------------------
-- scheduled_tasks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id),
  title         TEXT NOT NULL,
  description   TEXT,
  -- 'notify_underperformers' | 'custom_message' (extensible)
  action_type   TEXT NOT NULL DEFAULT 'custom_message',
  -- { audience: {...}, message: {...}, channel: 'whatsapp' }
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'active' | 'paused' | 'completed'
  status        TEXT NOT NULL DEFAULT 'active',
  -- 'once' | 'daily' | 'weekly' | 'monthly'
  frequency     TEXT NOT NULL DEFAULT 'once',
  at_hour       INTEGER NOT NULL DEFAULT 9,    -- 0-23, in `timezone`
  at_minute     INTEGER NOT NULL DEFAULT 0,    -- 0-59
  weekday       INTEGER,                       -- 0=Sun..6=Sat (weekly)
  day_of_month  INTEGER,                       -- 1-31 (monthly)
  run_at        TIMESTAMPTZ,                   -- absolute time (once)
  timezone      TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  next_run_at   TIMESTAMPTZ,
  last_run_at   TIMESTAMPTZ,
  run_count     INTEGER NOT NULL DEFAULT 0,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
  ON scheduled_tasks(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_org
  ON scheduled_tasks(org_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- scheduled_task_runs  (execution history / audit feed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_task_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organizations(id),
  -- 'running' | 'success' | 'partial' | 'failed'
  status           TEXT NOT NULL DEFAULT 'running',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  recipients_total INTEGER NOT NULL DEFAULT 0,
  recipients_sent  INTEGER NOT NULL DEFAULT 0,
  summary          TEXT,
  details          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task
  ON scheduled_task_runs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_runs_org
  ON scheduled_task_runs(org_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- RLS: enable, but grant no anon/auth policies. All reads/writes go through the
-- service-role client (bypasses RLS) in server routes, which scope by org_id.
-- ----------------------------------------------------------------------------
ALTER TABLE scheduled_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_task_runs  ENABLE ROW LEVEL SECURITY;

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scheduled_tasks_updated_at ON scheduled_tasks;
CREATE TRIGGER trg_scheduled_tasks_updated_at
  BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
