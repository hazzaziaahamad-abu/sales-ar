-- Create monthly expenses table for tracking organizational expenses
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON monthly_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON monthly_expenses(org_id, year, month);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON monthly_expenses(org_id, category);

ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_expenses" ON monthly_expenses FOR ALL USING (true) WITH CHECK (true);
