-- Add collection_status field to deals table for tracking payment collection
ALTER TABLE deals ADD COLUMN IF NOT EXISTS collection_status text DEFAULT 'معلق'
  CHECK (collection_status IN ('محصّل', 'معلق', 'متأخر'));
