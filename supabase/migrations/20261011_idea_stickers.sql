-- ─────────────────────────────────────────────────────────────────────────────
-- «أفكار»: لوحة استكرات مشتركة للفريق — كل استكر فكرة/تذكير/اقتراح بعنوان وتفاصيل.
-- kind يحدد شكل الاستكر ولونه: star (فكرة خاطفة) · note (تذكير) · circle (اقتراح).
-- sort_order لترتيب اللوحة بالسحب والإفلات. الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.idea_stickers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null default 'star' check (kind in ('star', 'note', 'circle')),
  tag text not null default '',
  title text not null default '',
  body text not null default '',
  sort_order integer not null default 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idea_stickers_org_idx on public.idea_stickers (org_id, sort_order, created_at);

alter table public.idea_stickers enable row level security;

update public.roles
  set allowed_pages = array_append(allowed_pages, 'ideas-board')
  where not ('ideas-board' = any(allowed_pages));
