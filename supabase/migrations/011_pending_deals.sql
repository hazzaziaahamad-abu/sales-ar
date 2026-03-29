-- Pending deals table for public submission forms
CREATE TABLE IF NOT EXISTS pending_deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id text NOT NULL,
  sales_type text NOT NULL DEFAULT 'office',
  client_name text NOT NULL,
  client_phone text,
  deal_value numeric NOT NULL DEFAULT 0,
  source text,
  stage text DEFAULT 'تواصل',
  plan text,
  assigned_rep_name text,
  notes text,
  submitter_name text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_deals_org ON pending_deals(org_id);
CREATE INDEX IF NOT EXISTS idx_pending_deals_status ON pending_deals(status);

ALTER TABLE pending_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert" ON pending_deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated read" ON pending_deals FOR SELECT USING (true);
CREATE POLICY "Allow authenticated update" ON pending_deals FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON pending_deals FOR DELETE USING (true);
