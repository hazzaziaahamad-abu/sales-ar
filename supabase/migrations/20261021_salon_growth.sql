-- ─────────────────────────────────────────────────────────────────────────────
-- «لوحة نمو الصالون» 🌸: عميلات الصالون، المواعيد (والحضور المباشر)، العضويات، والإعدادات.
--   salon_clients.last_visit_at / total_spent / visits: تتحدّث عند اكتمال موعد.
--   salon_appointments.addons: [{ name, price }] — البيع الإضافي (Upsell) على الموعد.
--   salon_growth_settings: مفتاح/قيمة (القوالب، بروتوكول الاستقبال، الخصم، اسم الصالون…).
-- إضافة جداول جديدة فقط — بدون أي تعديل على البيانات القائمة.
-- الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.salon_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text not null,
  favorite_service text,
  last_visit_at timestamptz,
  total_spent numeric not null default 0,
  visits integer not null default 0,
  winback_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, phone)
);
create index if not exists salon_clients_last_visit_idx on public.salon_clients (org_id, last_visit_at);
alter table public.salon_clients enable row level security;

create table if not exists public.salon_appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references public.salon_clients(id) on delete set null,
  client_name text not null,
  phone text not null,
  service text not null,
  staff text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60,
  price numeric not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'done')),
  kind text not null default 'booking' check (kind in ('booking', 'walkin')),
  addons jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  reminded_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists salon_appointments_time_idx on public.salon_appointments (org_id, starts_at);
create index if not exists salon_appointments_client_idx on public.salon_appointments (client_id);
alter table public.salon_appointments enable row level security;

create table if not exists public.salon_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  period text not null default 'شهرياً',
  perks jsonb not null default '[]'::jsonb,
  icon text not null default 'gem' check (icon in ('crown', 'gem', 'gift')),
  members integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists salon_memberships_org_idx on public.salon_memberships (org_id, sort_order);
alter table public.salon_memberships enable row level security;

create table if not exists public.salon_growth_settings (
  org_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);
alter table public.salon_growth_settings enable row level security;
