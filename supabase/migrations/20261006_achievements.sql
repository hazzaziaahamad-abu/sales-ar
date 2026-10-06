-- ─────────────────────────────────────────────────────────────────────────────
-- «الإنجازات»: إنجازات يدوية يسجّلها الفريق (اللي ما تطلع تلقائياً من النظام).
-- الإنجازات التلقائية (صفقات، تجديدات، تذاكر، تحديات، اجتماعات، مهام) تُجمع وقت العرض.
-- الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  owner_name text,                          -- صاحب الإنجاز (شخص أو فريق)
  category text not null default 'other'
    check (category in ('sales', 'customers', 'development', 'process', 'team', 'other')),
  achieved_on date not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists achievements_org_date_idx on public.achievements (org_id, achieved_on desc);

alter table public.achievements enable row level security;

update public.roles
  set allowed_pages = array_append(allowed_pages, 'achievements')
  where not ('achievements' = any(allowed_pages));
