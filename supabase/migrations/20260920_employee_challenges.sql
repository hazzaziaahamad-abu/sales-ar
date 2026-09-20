-- ─────────────────────────────────────────────────────────────────────────────
-- مركز معالجة تحديات الموظفين (Employee Challenge Resolution Center)
-- الموظف يرفع تحديًا من عنده؛ المدير (السوبر أدمن أو صاحب صلاحية challenges_manage)
-- هو الوحيد الذي يرى المشكلة كاملةً + الحلول (AI + اليدوية) + القياسات + التايم لاين.
-- الموظف يرى «حالة» تحدياته فقط. الحلول/القياسات/الأحداث سرّية عن الموظف عبر RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) التحديات
create table if not exists public.employee_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  challenge_number serial,
  submitted_by uuid,                 -- auth.users.id — يُخزَّن دائمًا ليتابع الموظف حالته
  submitter_name text,               -- اسم المقدّم (يُخفى عن المدير عند is_anonymous)
  is_anonymous boolean not null default false,
  category text not null default 'communication'
    check (category in ('communication','coworker_error','admin_delay','other')),
  against_party text,                 -- الطرف/القسم المعني (اختياري)
  title text not null,
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  status text not null default 'new'
    check (status in ('new','under_review','solutions_proposed','in_progress','measuring','resolved','closed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_challenges_org_idx
  on public.employee_challenges (org_id, status, created_at desc);
create index if not exists employee_challenges_submitter_idx
  on public.employee_challenges (submitted_by, created_at desc);

-- 2) الحلول (مصدرها AI أو المدير) — سرّية عن الموظف
create table if not exists public.challenge_solutions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.employee_challenges(id) on delete cascade,
  org_id uuid not null,
  source text not null default 'manager' check (source in ('ai','manager')),
  content text not null,
  steps jsonb,                       -- خطوات تنفيذية (غالبًا لحلول AI)
  expected_impact text,
  is_applied boolean not null default false,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists challenge_solutions_challenge_idx
  on public.challenge_solutions (challenge_id, created_at);

-- 3) أداة قياس النجاح (مؤشر رقمي قبل/بعد) — سرّية عن الموظف
create table if not exists public.challenge_measurements (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.employee_challenges(id) on delete cascade,
  org_id uuid not null,
  metric_name text not null,
  unit text,
  baseline_value numeric,            -- القيمة قبل تطبيق الحل
  target_value numeric,              -- الهدف
  current_value numeric,             -- القيمة الحالية/بعد
  direction text not null default 'increase' check (direction in ('increase','decrease')),
  measured_at date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists challenge_measurements_challenge_idx
  on public.challenge_measurements (challenge_id, created_at);

-- 4) التايم لاين (الأحداث) — سرّي عن الموظف
create table if not exists public.challenge_events (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.employee_challenges(id) on delete cascade,
  org_id uuid not null,
  event_type text not null,          -- submitted/status_changed/solution_added/solution_applied/measurement_logged/resolved/note
  description text,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists challenge_events_challenge_idx
  on public.challenge_events (challenge_id, created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.employee_challenges  enable row level security;
alter table public.challenge_solutions  enable row level security;
alter table public.challenge_measurements enable row level security;
alter table public.challenge_events     enable row level security;

-- التحديات: أي موظف مسجّل يستطيع الرفع، ولا يقرأ إلا تحدياته هو (حالتها).
drop policy if exists "employee_challenges_insert" on public.employee_challenges;
create policy "employee_challenges_insert" on public.employee_challenges
  for insert to authenticated with check (true);

drop policy if exists "employee_challenges_select_own" on public.employee_challenges;
create policy "employee_challenges_select_own" on public.employee_challenges
  for select to authenticated using (submitted_by = auth.uid());

-- الحلول/القياسات/الأحداث: لا سياسات قراءة/كتابة للموظفين إطلاقًا.
-- الوصول محصور بمفتاح الخدمة (service role) عبر مسارات المدير في الـ API، مما يضمن
-- أن المدير وحده يرى الحلول والقياسات. (RLS مفعّلة بلا سياسات = مرفوضة للجميع عدا service role.)

-- ─── الصلاحيات / الشريط الجانبي ───────────────────────────────────────────────
-- صفحة الموظف متاحة لكل الأدوار؛ صفحة المدير للسوبر أدمن فقط.
update public.roles
  set allowed_pages = array_append(allowed_pages, 'my-challenges')
  where not ('my-challenges' = any(allowed_pages));

update public.roles
  set allowed_pages = array_append(allowed_pages, 'challenges')
  where slug = 'super_admin' and not ('challenges' = any(allowed_pages));

-- تسجيل مفتاح الصلاحية في جدول permission_keys (إن وُجد) ليظهر في صفحة الحوكمة.
do $$
begin
  if to_regclass('public.permission_keys') is not null then
    begin
      insert into public.permission_keys (key, label_ar, description_ar, category, sort_order)
      values ('challenges_manage', 'إدارة تحديات الموظفين',
              'عرض ومعالجة التحديات التي يرفعها الموظفون واقتراح الحلول وقياس نجاحها',
              'الإدارة التنفيذية', 100)
      on conflict do nothing;
    exception when others then
      null; -- اختلاف الأعمدة لا يجب أن يُفشل الهجرة
    end;
  end if;
end $$;
