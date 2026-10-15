-- ─────────────────────────────────────────────────────────────────────────────
-- «الشرائح»: تقطيع الفكرة إلى مهام صغيرة تنجز كل وحدة في جلسة واحدة.
--   kind: deep (🔥 عميقة ٦٠–٩٠ د) | shallow (⚡ سطحية أقل من ١٥ د)
--   planned_for: اليوم المختار لها (شرائح اليوم/بكرة) — null = في «باقي الشرائح»
--   done_at: وقت الإنجاز
-- الشرائح خاصة بصاحبها حتى لو كانت الفكرة الأم مشتركة على اللوحة.
-- إضافة جدول جديد فقط — بدون أي تعديل على idea_stickers أو بياناتها.
-- الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.focus_slices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  space text not null default 'ideas' check (space in ('ideas', 'work')),
  idea_id uuid references public.idea_stickers(id) on delete cascade,
  title text not null,
  kind text not null default 'shallow' check (kind in ('deep', 'shallow')),
  planned_for date,
  done_at timestamptz,
  focus_minutes integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists focus_slices_owner_idx on public.focus_slices (org_id, user_id, space, created_at);
create index if not exists focus_slices_plan_idx on public.focus_slices (user_id, space, planned_for);
create index if not exists focus_slices_idea_idx on public.focus_slices (idea_id);

alter table public.focus_slices enable row level security;
