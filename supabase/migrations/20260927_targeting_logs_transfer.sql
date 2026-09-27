-- سجل لكل عميل في قائمة الاستهداف + نقله لمبيعات الدعم أو التجديدات عند الموافقة.
CREATE TABLE IF NOT EXISTS targeting_client_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES targeting_clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note', -- note | contact | transfer
  contact_status TEXT,
  satisfaction_result TEXT,
  note TEXT,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_targeting_client_logs_client
  ON targeting_client_logs(client_id, created_at);

ALTER TABLE targeting_client_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targeting_client_logs_select" ON targeting_client_logs FOR SELECT USING (true);
CREATE POLICY "targeting_client_logs_insert" ON targeting_client_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "targeting_client_logs_update" ON targeting_client_logs FOR UPDATE USING (true);
CREATE POLICY "targeting_client_logs_delete" ON targeting_client_logs FOR DELETE USING (true);

ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS transferred_to TEXT;     -- support | renewals
ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS transferred_ref UUID;    -- deals.id / renewals.id
