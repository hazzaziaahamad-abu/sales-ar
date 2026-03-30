CREATE TABLE gift_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  entity_type TEXT NOT NULL DEFAULT 'renewal',
  entity_id UUID,
  gift_title TEXT NOT NULL,
  gift_description TEXT,
  gift_type TEXT NOT NULL DEFAULT 'discount',
  gift_value TEXT,
  gift_emoji TEXT DEFAULT '🎁',
  box_color TEXT DEFAULT 'purple',
  status TEXT NOT NULL DEFAULT 'pending',
  opened_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gift_offers_org ON gift_offers(org_id);
CREATE INDEX idx_gift_offers_status ON gift_offers(org_id, status);

ALTER TABLE gift_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_offers_select" ON gift_offers FOR SELECT USING (true);
CREATE POLICY "gift_offers_insert" ON gift_offers FOR INSERT WITH CHECK (true);
CREATE POLICY "gift_offers_update" ON gift_offers FOR UPDATE USING (true);
CREATE POLICY "gift_offers_delete" ON gift_offers FOR DELETE USING (true);
