-- ─────────────────────────────────────────────────────────────────────────────
-- «طلبات التحقق»: المدير يطلب من موظف يتحقق من قائمة عملاء (مثلاً اللي في التجربة)،
-- الموظف يرد بالحالة الفعلية لكل عميل، والنظام يطابق الرد مع البيانات.
--   items      لقطة القائمة وقت إرسال الطلب
--   responses  رد الموظف لكل عنصر  { "<entity_id>": { status, note, last_contact } }
--   extras     عملاء ذكرهم الموظف ومو موجودين في القائمة
--   applied    تحديثات النظام اللي طبّقها المدير من شاشة المطابقة
-- الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  request_number serial,
  template text not null check (template in ('trial', 'awaiting_payment', 'stale', 'renewals_week')),
  scope text not null check (scope in ('support', 'office', 'all')),
  params jsonb not null default '{}',
  assignee_id uuid not null,
  assignee_name text,
  note text,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'answered', 'reviewed')),
  items jsonb not null default '[]',
  responses jsonb not null default '{}',
  extras jsonb not null default '[]',
  applied jsonb not null default '{}',
  responded_at timestamptz,
  reviewed_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verification_requests_org_idx on public.verification_requests (org_id, status, created_at desc);
create index if not exists verification_requests_assignee_idx on public.verification_requests (assignee_id, status);

alter table public.verification_requests enable row level security;
