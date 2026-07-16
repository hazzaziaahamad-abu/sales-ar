-- Link targeting_clients rows back to the originating deal so that selecting a
-- deal in the sales table adds it to قائمة الاستهداف and clicking it there can
-- open the deal in place.
ALTER TABLE targeting_clients
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE targeting_clients
  ADD COLUMN IF NOT EXISTS sales_type TEXT;

-- One targeting row per deal per month/year, so re-selecting a deal never
-- creates duplicates (used as the upsert conflict target). Kept non-partial so
-- it can serve as an ON CONFLICT arbiter; manual rows (deal_id NULL) never
-- collide because NULLs are distinct in a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_targeting_clients_deal
  ON targeting_clients(org_id, deal_id, month, year);
