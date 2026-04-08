CREATE TABLE IF NOT EXISTS product_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  section TEXT NOT NULL CHECK (section IN ('menu', 'reservations')),
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Star',
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_features_select" ON product_features FOR SELECT USING (true);
CREATE POLICY "product_features_insert" ON product_features FOR INSERT WITH CHECK (true);
CREATE POLICY "product_features_update" ON product_features FOR UPDATE USING (true);
CREATE POLICY "product_features_delete" ON product_features FOR DELETE USING (true);
