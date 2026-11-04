-- «مكتب المحتوى» — خطة نشر أخصائي المحتوى (انستقرام وتيك توك) + حالة الواتساب اليومية + أهداف الشهر.
-- إضافات فقط: ثلاث جداول جديدة. الوصول عبر مسارات الـ API (service role) — نفس نمط package_posts.

-- ─── 1) المنشورات المخططة ───────────────────────────────────────────────
create table if not exists public.content_desk_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null,                         -- صاحب المكتب (user_profiles.id)
  item_date         date not null,
  item_time         text check (item_time is null or item_time ~ '^\d{2}:\d{2}$'),
  idea              text not null,
  content_type      text not null default 'awareness' check (content_type in ('awareness', 'interactive', 'promo', 'bts')),
  platform          text not null default 'ig' check (platform in ('ig', 'tt', 'both')),
  format            text not null default 'reel' check (format in ('reel', 'post', 'carousel', 'story', 'video')),
  status            text not null default 'planned' check (status in ('planned', 'ready', 'done')),
  target_views      integer check (target_views is null or target_views >= 0),
  target_engagement integer check (target_engagement is null or target_engagement >= 0),
  actual_views      integer check (actual_views is null or actual_views >= 0),
  actual_engagement integer check (actual_engagement is null or actual_engagement >= 0),
  link              text,
  note              text,
  done_at           timestamptz,
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_content_desk_items_user_date on public.content_desk_items (org_id, user_id, item_date);
alter table public.content_desk_items enable row level security;

-- ─── 2) اليوم: حالة الواتساب + قائمة اليوم ──────────────────────────────
create table if not exists public.content_desk_days (
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null,
  day           date not null,                              -- تاريخ الرياض
  wa_status_at  timestamptz,                                -- وقت تفعيل حالة الواتساب
  checklist     jsonb not null default '{}',                -- {"replies": true}
  updated_at    timestamptz not null default now(),
  primary key (org_id, user_id, day)
);
alter table public.content_desk_days enable row level security;

-- ─── 3) أهداف الشهر ─────────────────────────────────────────────────────
create table if not exists public.content_desk_goals (
  org_id             uuid not null references organizations(id) on delete cascade,
  user_id            uuid not null,
  period             text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- YYYY-MM
  views_target       integer,
  posts_target       integer,                               -- فارغ = عدد المخطط
  ig_followers_target integer,
  tt_followers_target integer,
  ig_followers_now   integer,                               -- المتابعين الجدد حتى الآن (يُحدّث يدوياً)
  tt_followers_now   integer,
  updated_by         uuid,
  updated_at         timestamptz not null default now(),
  primary key (org_id, user_id, period)
);
alter table public.content_desk_goals enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role فقط.
