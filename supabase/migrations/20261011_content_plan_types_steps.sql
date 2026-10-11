-- التسويق بالمحتوى: نوعين من الخطط + مراحل التنفيذ لكل محتوى.
-- plan_type: creation = خطة إنشاء محتوى (بوستات/فيديوهات) · publishing = خطة نشر محتوى (جدول نشر).
-- step_template: مراحل التنفيذ الافتراضية للخطة (نصوص) — تُنسخ لكل محتوى جديد. فاضية = القالب الافتراضي حسب النوع.
-- steps: مراحل تنفيذ المحتوى [{ id, title, note, done, done_at, done_by }] — تُعلَّم مكتملة مرحلة مرحلة.
alter table public.content_plans add column if not exists plan_type text not null default 'creation';
alter table public.content_plans drop constraint if exists content_plans_plan_type_check;
alter table public.content_plans add constraint content_plans_plan_type_check check (plan_type in ('creation','publishing'));
alter table public.content_plans add column if not exists step_template jsonb not null default '[]'::jsonb;

alter table public.content_items add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.content_items add column if not exists publish_time text not null default '';  -- مثال 20:30
alter table public.content_items add column if not exists post_url text not null default '';      -- رابط المنشور بعد النشر
