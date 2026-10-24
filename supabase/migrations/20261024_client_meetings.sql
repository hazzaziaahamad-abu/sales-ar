-- ─────────────────────────────────────────────────────────────────────────────
-- «خطة اجتماع العميل»: كل رابط عرض (/offer/meeting?m=<token>) مربوط بصفقة وموظف،
-- عشان نعرف كم اجتماع تم وكم عميل تحوّل لموافق بعده (من مرحلة الصفقة).
-- الكتابة والقراءة عبر مفتاح الخدمة من مسارات API فقط. إضافات فقط.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  token text not null unique,
  product text not null,               -- 'menu' | 'nahjez'
  client_name text not null default '',
  client_phone text,
  rep_id uuid,
  rep_name text,
  stage_at_start text,                 -- مرحلة الصفقة وقت إنشاء الاجتماع
  tier_name text,                      -- الباقة اللي اختارها العميل أثناء العرض
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_meetings_org_idx on public.client_meetings (org_id, created_at desc);
create index if not exists client_meetings_deal_idx on public.client_meetings (deal_id);
alter table public.client_meetings enable row level security;
