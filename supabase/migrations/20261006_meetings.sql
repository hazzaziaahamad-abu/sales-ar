-- ─────────────────────────────────────────────────────────────────────────────
-- «الاجتماعات»: جدول اجتماعات الفريق — موعد، حضور، أجندة، ومحضر بعد الانتهاء.
-- الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  meeting_type text not null default 'internal'
    check (meeting_type in ('daily', 'weekly', 'internal', 'client', 'partner', 'other')),
  meeting_date date not null,
  start_time text not null,                 -- HH:MM بتوقيت السعودية
  duration_minutes int not null default 30,
  location text,                            -- مكان أو رابط اجتماع
  attendees text[] not null default '{}',   -- أسماء الحضور
  agenda text,
  minutes text,                             -- المحضر: وش انقال ووش انقرر
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  created_by uuid,
  created_by_name text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_org_date_idx on public.meetings (org_id, meeting_date, start_time);

alter table public.meetings enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role في مسارات الـ API فقط.

-- الصفحة متاحة لكل الأدوار.
update public.roles
  set allowed_pages = array_append(allowed_pages, 'meetings')
  where not ('meetings' = any(allowed_pages));
