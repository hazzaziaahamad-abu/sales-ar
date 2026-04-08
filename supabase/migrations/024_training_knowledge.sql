-- Training knowledge base: editable content for AI training sessions
CREATE TABLE IF NOT EXISTS training_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  topic_key TEXT NOT NULL,
  topic_title TEXT NOT NULL DEFAULT '',
  topic_prompt TEXT NOT NULL DEFAULT '',
  product_knowledge TEXT NOT NULL DEFAULT '',
  system_wrapper TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, topic_key)
);

-- Enable RLS
ALTER TABLE training_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "training_knowledge_select" ON training_knowledge FOR SELECT USING (true);
CREATE POLICY "training_knowledge_insert" ON training_knowledge FOR INSERT WITH CHECK (true);
CREATE POLICY "training_knowledge_update" ON training_knowledge FOR UPDATE USING (true);
CREATE POLICY "training_knowledge_delete" ON training_knowledge FOR DELETE USING (true);
