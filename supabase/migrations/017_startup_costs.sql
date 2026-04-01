-- Startup/founding costs tracking table
CREATE TABLE IF NOT EXISTS startup_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_costs_org ON startup_costs(org_id);

ALTER TABLE startup_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "startup_costs_all" ON startup_costs FOR ALL USING (true) WITH CHECK (true);
