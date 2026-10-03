-- ─────────────────────────────────────────────────────────────────────────────
-- التسويق بالمحتوى (تحت «الخطط التسويقية»)
-- خطة محتوى = مجموعة عناصر (فيديو/ريلز/بوست/كاروسيل/ستوري) لكل عنصر عنوان وفكرة وسكربت.
-- لكل خطة رابط مشاركة عام (share_token) يُفتح بدون تسجيل دخول: عرض فقط أو تعديل.
-- الوصول كله عبر مسارات الـAPI بمفتاح الخدمة؛ RLS مفعّلة بلا سياسات = مرفوضة لغير service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.content_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  audience text not null default '',          -- الجمهور المستهدف
  related_product text not null default '',
  platforms text[] not null default '{}',      -- instagram / tiktok / snapchat / x / youtube / linkedin
  tone text not null default '',               -- نبرة المحتوى
  status text not null default 'draft' check (status in ('draft','in_progress','done','archived')),
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  share_enabled boolean not null default false,
  share_mode text not null default 'view' check (share_mode in ('view','edit')),
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_plans_org_idx on public.content_plans (org_id, created_at desc);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.content_plans(id) on delete cascade,
  kind text not null default 'video' check (kind in ('video','reel','post','carousel','story')),
  title text not null default '',
  idea text not null default '',
  script text not null default '',             -- سكربت الفيديو أو نص التصميم
  caption text not null default '',            -- الكابشن / النص المرافق
  platform text not null default '',
  publish_date date,
  status text not null default 'idea' check (status in ('idea','writing','ready','published')),
  source text not null default 'manual' check (source in ('manual','ai')),
  sort_order integer not null default 0,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_items_plan_idx on public.content_items (plan_id, sort_order, created_at);

alter table public.content_plans enable row level security;
alter table public.content_items enable row level security;
