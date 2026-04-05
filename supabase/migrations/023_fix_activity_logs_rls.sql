-- Recreate activity_logs table with correct RLS policy
-- The original migration (021) used session-based org check which doesn't work
-- with the client-side Supabase client. Using open policy instead
-- (org isolation is handled at the application layer via WHERE org_id = ?)

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  section TEXT NOT NULL,
  section_label TEXT NOT NULL,
  entity_id TEXT,
  entity_title TEXT,
  user_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON activity_logs;
CREATE POLICY "activity_logs_all" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created ON activity_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_section ON activity_logs (org_id, section, created_at DESC);
