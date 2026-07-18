CREATE TABLE IF NOT EXISTS sales_playbook (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE sales_playbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read playbook"
  ON sales_playbook FOR SELECT
  USING (org_id = (SELECT org_id FROM org_users WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "org members can upsert playbook"
  ON sales_playbook FOR ALL
  USING (org_id = (SELECT org_id FROM org_users WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (org_id = (SELECT org_id FROM org_users WHERE user_id = auth.uid() LIMIT 1));
