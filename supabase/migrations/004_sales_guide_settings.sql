-- Sales Guide Settings (editable pipeline stages, activity points, score levels)
CREATE TABLE sales_guide_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, setting_key)
);
ALTER TABLE sales_guide_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_guide_settings_org ON sales_guide_settings(org_id);
CREATE POLICY "sales_guide_settings_all" ON sales_guide_settings FOR ALL USING (true) WITH CHECK (true);

-- Seed default pipeline stages
INSERT INTO sales_guide_settings (org_id, setting_key, setting_value) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'pipeline_stages',
  '[
    {"stage": "Lead جديد", "probability": 0, "color": "cc-blue"},
    {"stage": "تواصل أولي", "probability": 15, "color": "cyan"},
    {"stage": "عرض سعر", "probability": 40, "color": "amber"},
    {"stage": "تفاوض", "probability": 70, "color": "cc-purple"},
    {"stage": "إغلاق", "probability": 90, "color": "cc-green"}
  ]'::jsonb
),
(
  '00000000-0000-0000-0000-000000000001',
  'activity_points',
  '[
    {"key": "call", "label": "مكالمة هاتفية", "icon": "📞", "points": 10},
    {"key": "followup", "label": "متابعة", "icon": "🔁", "points": 10},
    {"key": "whatsapp", "label": "واتساب", "icon": "💬", "points": 10},
    {"key": "meeting", "label": "اجتماع", "icon": "🤝", "points": 10},
    {"key": "demo", "label": "Demo", "icon": "🖥", "points": 20},
    {"key": "quote", "label": "عرض سعر", "icon": "📄", "points": 10},
    {"key": "deal_closed", "label": "إغلاق صفقة", "icon": "✅", "points": 50},
    {"key": "stale_deal", "label": "صفقة راكدة", "icon": "⏳", "points": -10},
    {"key": "slow_response", "label": "رد بطيء", "icon": "🐌", "points": -5}
  ]'::jsonb
),
(
  '00000000-0000-0000-0000-000000000001',
  'score_levels',
  '[
    {"value": "excellent", "label": "ممتاز", "emoji": "🏆", "minPoints": 250, "color": "cc-green"},
    {"value": "advanced", "label": "متقدم", "emoji": "🥇", "minPoints": 180, "color": "cyan"},
    {"value": "good", "label": "جيد", "emoji": "🥈", "minPoints": 120, "color": "amber"},
    {"value": "needs_improvement", "label": "يحتاج تحسين", "emoji": "🥉", "minPoints": 60, "color": "cc-purple"},
    {"value": "danger", "label": "خطر", "emoji": "🔴", "minPoints": 0, "color": "cc-red"}
  ]'::jsonb
);
