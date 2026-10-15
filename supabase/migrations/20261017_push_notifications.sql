-- ─────────────────────────────────────────────────────────────────────────────
-- إشعارات الجوال (Web Push) — توصل حتى لو التطبيق مقفل.
--   push_config:        مفاتيح VAPID + سر الـcron (صف واحد، service role فقط — تُعبّأ خارج git)
--   push_subscriptions: اشتراكات أجهزة المستخدمين
--   push_log:           منع التكرار — كل تذكير مرة وحدة باليوم
--   push_queue:         إشعارات مجدولة لوقت محدد (مثل انتهاء جلسة التركيز)
-- إضافات فقط. الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_config (
  id integer primary key default 1 check (id = 1),
  vapid_public text not null,
  vapid_private text not null,
  vapid_subject text not null default 'mailto:admin@example.com',
  cron_secret text not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_log (
  user_id uuid not null,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.push_log enable row level security;

create table if not exists public.push_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tag text not null,
  send_at timestamptz not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tag)
);
create index if not exists push_queue_due_idx on public.push_queue (send_at) where sent_at is null;
alter table public.push_queue enable row level security;

-- تعبئة push_config (مرة وحدة، خارج git): مفاتيح VAPID من `npx web-push generate-vapid-keys`
--   insert into public.push_config (id, vapid_public, vapid_private, vapid_subject, cron_secret)
--   values (1, '<public>', '<private>', 'https://<app-url>', encode(extensions.gen_random_bytes(32), 'hex'));

-- المؤقت: كل دقيقة يستدعي /api/cron/focus-push بالسر المخزّن في push_config (ما يعتمد على متغيرات Vercel)
select cron.schedule(
  'focus-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://sales-ar-seven.vercel.app/api/cron/focus-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-push-secret', (select cron_secret from public.push_config where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
