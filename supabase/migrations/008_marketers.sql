-- Create marketers table for tracking commission-based marketers
CREATE TABLE IF NOT EXISTS marketers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  phone TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketers_org ON marketers(org_id);
CREATE INDEX IF NOT EXISTS idx_marketers_active ON marketers(org_id, is_active);

ALTER TABLE marketers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_marketers" ON marketers FOR ALL USING (true) WITH CHECK (true);

-- Add marketer_name column to deals table for linking deals to marketers
ALTER TABLE deals ADD COLUMN IF NOT EXISTS marketer_name TEXT;
