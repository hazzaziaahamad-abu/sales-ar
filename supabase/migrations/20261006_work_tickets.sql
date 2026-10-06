-- ─────────────────────────────────────────────────────────────────────────────
-- «الطلبات والتطويرات»: تذاكر عمل تنفتح وتنقفل بعد الإنجاز أو الحل.
--   customer_request  طلب عميل يحتاج حل
--   development       تطوير على النظام
-- منفصلة عن مركز معالجة التحديات. الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.work_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  ticket_number serial,
  kind text not null check (kind in ('customer_request', 'development')),
  title text not null,
  description text not null default '',
  client_name text,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid,
  created_by_name text,
  assigned_to uuid,
  assigned_to_name text,
  due_date date,
  resolution text,                  -- وش انعمل عند الإغلاق
  closed_at timestamptz,
  closed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_tickets_org_idx on public.work_tickets (org_id, status, created_at desc);

create table if not exists public.work_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.work_tickets(id) on delete cascade,
  org_id uuid not null,
  event_type text not null,         -- created / status / assigned / comment / edited
  body text,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists work_ticket_events_ticket_idx on public.work_ticket_events (ticket_id, created_at);

alter table public.work_tickets enable row level security;
alter table public.work_ticket_events enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role في مسارات الـ API فقط.

-- نقل طلبات العملاء والتطويرات اللي انرفعت سابقاً في مركز التحديات.
insert into public.work_tickets
  (org_id, kind, title, description, client_name, priority, status, created_by, created_by_name, closed_at, created_at, updated_at)
select
  org_id, kind, title, description, client_name,
  case severity when 'high' then 'high' else 'normal' end,
  case status
    when 'resolved' then 'done'
    when 'closed' then 'cancelled'
    when 'new' then 'open'
    when 'under_review' then 'open'
    else 'in_progress'
  end,
  submitted_by, submitter_name, resolved_at, created_at, updated_at
from public.employee_challenges
where kind in ('customer_request', 'development');

insert into public.work_ticket_events (ticket_id, org_id, event_type, body, actor_name, created_at)
select id, org_id, 'created', 'تم فتح التذكرة (منقولة من مركز التحديات)', created_by_name, created_at
from public.work_tickets;

-- السجلات الأصلية تبقى في employee_challenges لكن مركز التحديات يعرض kind = 'challenge' فقط.

-- الصفحة متاحة لكل الأدوار (مثل «تحدياتي» سابقاً).
update public.roles
  set allowed_pages = array_append(allowed_pages, 'work-tickets')
  where not ('work-tickets' = any(allowed_pages));
