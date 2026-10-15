-- ─────────────────────────────────────────────────────────────────────────────
-- «العمل الوظيفي» 💼: مساحة مستقلة تماماً عن مهام MENU — بنود العمل الخاصة بالسوبر أدمن،
-- وتتقطع لشرائح بنفس جدول focus_slices (space = 'work').
-- session_at: موعد الجلسة العميقة لليوم (للشريحة العميقة المخططة).
-- إضافات فقط — بدون تعديل أي بيانات قائمة.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  notes text not null default '',
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_items_owner_idx on public.work_items (org_id, user_id, created_at);
alter table public.work_items enable row level security;

alter table public.focus_slices
  add column if not exists work_item_id uuid references public.work_items(id) on delete cascade;
alter table public.focus_slices add column if not exists session_at time;
create index if not exists focus_slices_work_item_idx on public.focus_slices (work_item_id);
