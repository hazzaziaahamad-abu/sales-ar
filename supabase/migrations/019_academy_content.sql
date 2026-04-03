-- Academy content table for learning materials
CREATE TABLE IF NOT EXISTS academy_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('menu', 'reservations')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE academy_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON academy_content FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_select" ON academy_content FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON academy_content FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON academy_content FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON academy_content FOR DELETE TO anon USING (true);
