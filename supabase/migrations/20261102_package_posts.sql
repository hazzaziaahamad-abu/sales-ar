-- ─────────────────────────────────────────────────────────────────────────────
-- «صفحة المصمم» → استوديو بوستات الباقات: كل بوست = كائن JSON (data) + اسم القالب.
-- القالب يرسم البيانات بالمقاس الحقيقي في الواجهة. الوصول عبر مسارات الـ API (service role).
-- الصور المرفوعة تنحفظ داخل data كـ data URL (مصغّرة) عشان ما تنكسر وقت التصدير.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.package_posts (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  template text not null check (template in ('basic', 'vip', 'vipPlus', 'cashier')),
  title text not null default '',
  data jsonb not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists package_posts_org_idx on public.package_posts (org_id, created_at);

alter table public.package_posts enable row level security;

update public.roles
  set allowed_pages = array_append(allowed_pages, 'designer')
  where 'marketing-plans' = any(allowed_pages) and not ('designer' = any(allowed_pages));
