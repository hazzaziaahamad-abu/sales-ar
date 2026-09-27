-- هدف يومي للموظف: من حدّد العميل كهدف اليوم، ومن نفّذ الترقية (النقل).
ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS target_by TEXT;
ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS transferred_by TEXT;
CREATE INDEX IF NOT EXISTS idx_targeting_clients_transferred_at ON targeting_clients(org_id, transferred_at);
