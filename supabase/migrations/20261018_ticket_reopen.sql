-- ─────────────────────────────────────────────────────────────────────────────
-- إعادة فتح تذاكر الدعم مع ذكر السبب — عشان الفريق يعرف ليش رجعت التذكرة.
-- إضافات فقط.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tickets add column if not exists reopen_reason text;
alter table public.tickets add column if not exists reopen_count integer not null default 0;
alter table public.tickets add column if not exists reopened_at timestamptz;
alter table public.tickets add column if not exists reopened_by text;
