-- ─────────────────────────────────────────────────────────────────────────────
-- متابعة التذاكر الساكتة (٤٨ ساعة بدون تحديث) — بموافقة السوبر أدمن.
--   ١) النظام يجهّز مسودة متابعة لكل تذكرة ساكتة (كل الأقسام) ويشعر السوبر أدمن.
--   ٢) السوبر أدمن يراجع/يعدّل النص ويوافق أو يرفض من صفحة «متابعة التذاكر».
--   ٣) بعد الموافقة تتوزع أوقات الإرسال على الدوام بشكل طبيعي، وتنكتب باسمه كتعليق عادي فيه منشن.
-- الوصول عبر مسارات الـ API (service role) فقط.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ticket_followups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source text not null check (source in ('support', 'work')),
  ticket_id uuid not null,
  ticket_number integer,
  title text not null default '',
  assignee_name text not null,
  assignee_id uuid,
  last_activity_at timestamptz not null,     -- آخر نشاط على التذكرة وقت تجهيز المسودة
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'sending', 'sent', 'rejected', 'skipped')),
  author_name text,                          -- اسم اللي وافق (التعليق ينكتب باسمه)
  send_at timestamptz,
  decided_at timestamptz,
  sent_at timestamptz,
  skip_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_followups_status_idx on public.ticket_followups (status, send_at);
create index if not exists ticket_followups_ticket_idx on public.ticket_followups (ticket_id, created_at desc);
-- مسودة وحدة مفتوحة لكل تذكرة
create unique index if not exists ticket_followups_one_open
  on public.ticket_followups (ticket_id) where status in ('pending', 'approved', 'sending');

alter table public.ticket_followups enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role فقط.

-- المؤقت: كل دقيقة (يرسل المعتمدة في وقتها، ويجهّز المسودات كل ربع ساعة وقت الدوام)
do $$
begin
  perform cron.unschedule('stale-tickets');
exception when others then null;
end $$;

select cron.schedule(
  'stale-tickets',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://sales-ar-seven.vercel.app/api/cron/stale-tickets',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-push-secret', (select cron_secret from public.push_config where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
