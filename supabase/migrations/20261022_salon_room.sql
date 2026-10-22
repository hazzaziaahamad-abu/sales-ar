-- ─────────────────────────────────────────────────────────────────────────────
-- «غرفة التخطيط والتنفيذ» 🗂️: مساحة فريق مستشاري الصالونات لتنفيذ آلية العميل.
--   الدخول بكود فريق (يحدده السوبر أدمن) — بدون حسابات منصة للمستشارين.
--   consult_room_settings: بصمة كود الدخول (scrypt + salt)؛ تغيير الكود يُخرج الجميع.
--   consult_clients: صالونات العملاء ومرحلتهم في الآلية + المؤشرات (قبل/الحالي/الأهداف).
--   consult_tasks: مهام كل مرحلة (من دليل الآلية + مهام مخصّصة).
--   consult_logs: سجل المتابعات والملاحظات وتغيير المراحل.
--   consult_team: أعضاء الفريق (المستشارات).
-- إضافة جداول جديدة فقط. الوصول عبر مسارات /api/salon-room (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.consult_room_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  code_hash text not null,
  code_salt text not null,
  code_set_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.consult_room_settings enable row level security;

create table if not exists public.consult_team (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  role text not null default 'مستشارة',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
alter table public.consult_team enable row level security;

create table if not exists public.consult_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  salon_name text not null,
  owner_name text,
  phone text,
  city text,
  consultant text,
  stage text not null default 'lead'
    check (stage in ('lead', 'discovery', 'diagnosis', 'proposal', 'onboarding', 'execution', 'review', 'done', 'paused')),
  health text not null default 'on_track' check (health in ('on_track', 'at_risk', 'off_track')),
  start_date date,
  next_review date,
  contract_value numeric,
  baseline jsonb not null default '{}'::jsonb,
  current jsonb not null default '{}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consult_clients_org_idx on public.consult_clients (org_id, archived, stage);
alter table public.consult_clients enable row level security;

create table if not exists public.consult_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references public.consult_clients(id) on delete cascade,
  phase text not null,
  title text not null,
  due_date date,
  assignee text,
  done_at timestamptz,
  done_by text,
  custom boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists consult_tasks_client_idx on public.consult_tasks (client_id, phase, sort_order);
create index if not exists consult_tasks_org_idx on public.consult_tasks (org_id, done_at, due_date);
alter table public.consult_tasks enable row level security;

create table if not exists public.consult_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references public.consult_clients(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'checkin', 'meeting', 'stage')),
  body text not null,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists consult_logs_client_idx on public.consult_logs (client_id, created_at desc);
alter table public.consult_logs enable row level security;
