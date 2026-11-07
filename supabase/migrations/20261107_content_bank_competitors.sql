-- «مكتب المحتوى» — صفحتان جديدتان فوق الخطة:
--   1) بنك المحتوى: كل تصميم/ريلز/ستوري/فيديو نصممه نرفعه هنا (تخزين Supabase) ويُربط بمنشور الخطة لمعرفة نتائجه.
--   2) المنافسين: حسابات المنافسين (انستقرام/تيك توك) تُسحب يومياً (Apify) مع لقطة أرقام يومية ومنشوراتهم.
-- إضافات فقط. الوصول عبر مسارات الـ API (service role) — نفس نمط content_desk_*.

-- ─── 1) بنك المحتوى ─────────────────────────────────────────────────────
create table if not exists public.content_bank_assets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  title             text not null,
  kind              text not null default 'post' check (kind in ('post', 'reel', 'story', 'video', 'carousel')),
  platform          text not null default 'ig' check (platform in ('ig', 'tt', 'both')),
  content_type      text check (content_type is null or content_type in ('awareness', 'interactive', 'promo', 'bts')),
  storage_path      text not null,
  file_name         text not null,
  mime_type         text,
  size_bytes        bigint,
  tags              text[] not null default '{}',
  note              text,
  -- الربط بمنشور الخطة (يجيب المشاهدات والتفاعل الفعلية)
  desk_item_id      uuid references public.content_desk_items(id) on delete set null,
  -- أرقام يدوية لو المحتوى انتشر بدون منشور في الخطة
  views             integer check (views is null or views >= 0),
  engagement        integer check (engagement is null or engagement >= 0),
  downloads         integer not null default 0,
  uploaded_by       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_content_bank_org on public.content_bank_assets (org_id, created_at desc);
create index if not exists idx_content_bank_item on public.content_bank_assets (desk_item_id);
alter table public.content_bank_assets enable row level security;

-- مخزن الملفات (خاص — التحميل والعرض بروابط موقّعة مؤقتة)
insert into storage.buckets (id, name, public, file_size_limit)
values ('content-bank', 'content-bank', false, 524288000)
on conflict (id) do nothing;

-- ─── 2) المنافسين ───────────────────────────────────────────────────────
create table if not exists public.content_competitors (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  ig_username   text,
  tt_username   text,
  note          text,
  active        boolean not null default true,
  last_synced_at timestamptz,
  last_error    text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_content_competitors_org on public.content_competitors (org_id);
alter table public.content_competitors enable row level security;

-- لقطة يومية لكل منافس ومنصة (المتابعين + تفاعل آخر المنشورات)
create table if not exists public.content_competitor_snapshots (
  competitor_id  uuid not null references public.content_competitors(id) on delete cascade,
  platform       text not null check (platform in ('ig', 'tt')),
  day            date not null,                     -- تاريخ الرياض
  followers      bigint,
  following      bigint,
  posts_count    bigint,
  total_likes    bigint,                            -- تيك توك: مجموع القلوب للحساب
  avg_views      integer,
  avg_likes      integer,
  avg_comments   integer,
  engagement_rate numeric(7, 3),                    -- % (لايك+تعليق) ÷ المتابعين لآخر المنشورات
  source         text not null default 'apify' check (source in ('apify', 'manual')),
  created_at     timestamptz not null default now(),
  primary key (competitor_id, platform, day)
);
alter table public.content_competitor_snapshots enable row level security;

-- منشورات المنافسين (تتحدث أرقامها مع كل سحب)
create table if not exists public.content_competitor_posts (
  competitor_id  uuid not null references public.content_competitors(id) on delete cascade,
  platform       text not null check (platform in ('ig', 'tt')),
  post_id        text not null,
  url            text,
  kind           text,                              -- reel / post / carousel / video
  caption        text,
  thumbnail_url  text,
  posted_at      timestamptz,
  views          bigint,
  likes          bigint,
  comments       bigint,
  shares         bigint,
  first_seen_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (competitor_id, platform, post_id)
);
create index if not exists idx_competitor_posts_time on public.content_competitor_posts (competitor_id, posted_at desc);
alter table public.content_competitor_posts enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role فقط.

-- ─── 3) السحب اليومي (٦:٠٠ ص الرياض = ٠٣:٠٠ UTC) ──────────────────────
select cron.schedule(
  'competitors-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://sales-ar-seven.vercel.app/api/cron/competitors',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-push-secret', (select cron_secret from public.push_config where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
