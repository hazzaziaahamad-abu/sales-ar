-- منظمات إضافية يقدر المستخدم يفتحها (غير منظمته الأساسية) — يحددها السوبر أدمن من «إدارة المستخدمين»
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS extra_org_ids UUID[] NOT NULL DEFAULT '{}';
