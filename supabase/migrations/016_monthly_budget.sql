-- Monthly budget planning table
CREATE TABLE IF NOT EXISTS monthly_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  category TEXT NOT NULL,
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, category, month, year)
);

CREATE INDEX IF NOT EXISTS idx_budget_org_month ON monthly_budget(org_id, year, month);

ALTER TABLE monthly_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_all" ON monthly_budget FOR ALL USING (true) WITH CHECK (true);
