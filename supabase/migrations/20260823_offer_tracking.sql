-- تتبّع صفحات العرض العامة: زيارات مجهولة + عملاء محتملون (نموذج تواصل)
-- الكتابة تتم عبر مفتاح service_role من مسار API سيرفري (يتجاوز RLS).
-- القراءة متاحة لأي مستخدم مسجّل داخل لوحة التحكم.

create table if not exists public.offer_visits (
  id uuid primary key default gen_random_uuid(),
  page text not null,           -- 'menu' | 'nahjez'
  ref text,                     -- وسم الرابط المخصّص (?ref=)
  referrer text,                -- مصدر الزيارة
  device text,                  -- 'mobile' | 'tablet' | 'desktop'
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists offer_visits_created_idx on public.offer_visits (created_at desc);

create table if not exists public.offer_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  business_type text,
  page text,
  ref text,
  note text,
  status text not null default 'جديد',
  created_at timestamptz not null default now()
);
create index if not exists offer_leads_created_idx on public.offer_leads (created_at desc);

alter table public.offer_visits enable row level security;
alter table public.offer_leads  enable row level security;

-- القراءة: أي مستخدم مسجّل (موظفو الشركة)
drop policy if exists offer_visits_read_auth on public.offer_visits;
create policy offer_visits_read_auth on public.offer_visits
  for select to authenticated using (true);

drop policy if exists offer_leads_read_auth on public.offer_leads;
create policy offer_leads_read_auth on public.offer_leads
  for select to authenticated using (true);

-- تحديث حالة الـlead من لوحة التحكم
drop policy if exists offer_leads_update_auth on public.offer_leads;
create policy offer_leads_update_auth on public.offer_leads
  for update to authenticated using (true) with check (true);
