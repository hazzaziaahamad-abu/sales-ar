CREATE TABLE targeting_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  plan TEXT,
  source TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_date DATE,
  contact_status TEXT NOT NULL DEFAULT 'pending',
  satisfaction_result TEXT,
  notes TEXT,
  assigned_rep TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_targeting_clients_org ON targeting_clients(org_id);
CREATE INDEX idx_targeting_clients_month ON targeting_clients(org_id, month, year);
CREATE INDEX idx_targeting_clients_date ON targeting_clients(org_id, target_date);

ALTER TABLE targeting_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targeting_clients_select" ON targeting_clients FOR SELECT USING (true);
CREATE POLICY "targeting_clients_insert" ON targeting_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "targeting_clients_update" ON targeting_clients FOR UPDATE USING (true);
CREATE POLICY "targeting_clients_delete" ON targeting_clients FOR DELETE USING (true);
