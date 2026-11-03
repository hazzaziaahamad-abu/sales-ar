-- «مهام اليوم» + «مركز الإعدادات»
-- إضافات فقط: جدولان جديدان، أعمدة جديدة فارغة في sales_activities، ومفاتيح إعدادات جديدة.
-- لا يعدّل أي عمود أو صف موجود، ولا يلمس جدولي الصفقات والتجديدات.

-- ─── 1) خطة اليوم لكل موظف ───────────────────────────────────────────────
create table if not exists public.rep_daily_plans (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  user_id            uuid not null,                       -- user_profiles.id
  user_name          text not null,
  plan_date          date not null,                       -- تاريخ الرياض
  departments        text[] not null default '{}',        -- office | support | renewals
  started_at         timestamptz not null default now(),  -- «ابدأ مهام اليوم»
  first_activity_at  timestamptz,
  last_activity_at   timestamptz,
  finished_at        timestamptz,                         -- «أنهِ مهام اليوم»
  priorities         jsonb not null default '[]',         -- [{entity_type, entity_id, title}] حتى ٣
  extra_tasks        jsonb not null default '[]',         -- [{id, text, done_at}]
  unfinished_reason  text,                                -- سبب ما لم يكتمل عند الإنهاء
  blocker_note       text,                                -- «عائق تحتاج فيه مساعدة»
  close_exceptions   jsonb not null default '[]',         -- ما كان ناقصاً لحظة الإنهاء
  report             jsonb,                               -- لقطة التقرير التلقائي
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, user_id, plan_date)
);
create index if not exists idx_rep_daily_plans_org_date on public.rep_daily_plans (org_id, plan_date);

alter table public.rep_daily_plans enable row level security;
-- بلا سياسات: القراءة والكتابة عبر service role في مسارات الـ API فقط (نفس نمط meetings).

-- ─── 2) أهداف الأقسام والموظفين الشهرية ─────────────────────────────────
-- جدول مستقل لأن sales_targets فيه قيد فريد (org_id, period_type, target_key)
-- يمنع هدفاً لكل قسم وموظف، وتقرؤه صفحة دليل المبيعات والإشعارات.
create table if not exists public.dept_targets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  department        text not null check (department in ('office', 'support', 'renewals')),
  user_id           uuid,                                 -- null = هدف القسم
  period            text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- YYYY-MM
  metric            text not null default 'revenue' check (metric in ('revenue', 'closes')),
  min_value         numeric,
  target_value      numeric not null,
  stretch_value     numeric,
  share_pct         numeric check (share_pct is null or (share_pct >= 0 and share_pct <= 100)),
  method            text not null default 'manual' check (method in ('history', 'pipeline', 'manual')),
  basis             jsonb,                                -- مدخلات الحساب وقت الاعتماد
  approved_by       uuid,
  approved_by_name  text,
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_dept_targets_scope on public.dept_targets
  (org_id, department, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), period, metric);

alter table public.dept_targets enable row level security;
-- بلا سياسات: عبر service role في مسارات الـ API فقط.

-- ─── 3) سجل الأنشطة: إعادة استخدام sales_activities ───────────────────────
-- أعمدة جديدة كلها nullable وبدون قيمة افتراضية، فالصفوف الحالية لا تتغير.
-- activity_type و result يبقيان بقيمهما المسموحة الحالية؛ التفصيل يُكتب في outcome.
alter table public.sales_activities add column if not exists user_id        uuid;
alter table public.sales_activities add column if not exists department     text;
alter table public.sales_activities add column if not exists entity_type    text;   -- deal | renewal
alter table public.sales_activities add column if not exists renewal_id     uuid references renewals(id) on delete set null;
alter table public.sales_activities add column if not exists phone          text;
alter table public.sales_activities add column if not exists outcome        text;   -- replied | no_answer | meeting_booked | meeting_held | offer_sent | paid | lost
alter table public.sales_activities add column if not exists next_action_at timestamptz;
alter table public.sales_activities add column if not exists plan_id        uuid references rep_daily_plans(id) on delete set null;

create index if not exists idx_sales_activities_user_date on public.sales_activities (org_id, user_id, activity_date);
create index if not exists idx_sales_activities_plan on public.sales_activities (plan_id);

-- ─── 4) إعدادات افتراضية (مفاتيح جديدة فقط، لا تستبدل الموجود) ───────────
-- لقائمة الطلبات فقط. حجوزات لا تظهر لها «مهام اليوم» حتى يُضاف توزيعها من مركز الإعدادات.
insert into public.sales_guide_settings (org_id, setting_key, setting_value) values
  ('00000000-0000-0000-0000-000000000001', 'daily_work_days', '[0,1,2,3,4,5,6]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'daily_queue_cap', '40'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'deal_speed_thresholds', '{"fast":3,"normal":10,"slow":20}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'daily_activity_targets',
    '{"office":{"prospect":30,"meetings":2},"support":{"prospect":0,"meetings":1},"renewals":{"prospect":0,"meetings":0}}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'dept_members', '{
    "office":   [{"user_id":"175833e7-7bd1-42be-8826-776339dcd7be","name":"عواطف"},
                 {"user_id":"4c1193b5-0a31-4a54-85ab-e5bfe8853358","name":"هنا"}],
    "support":  [{"user_id":"b050a916-40df-467b-822d-bddf4651bd06","name":"علي"},
                 {"user_id":"6e2074c4-577e-4773-8905-6fa0a69b0f9d","name":"مريم"},
                 {"user_id":"5bb24a0f-43f8-49d5-b8a6-a84923d49bd3","name":"Manal"}],
    "renewals": [{"user_id":"524a2f29-ef38-4da2-ac93-3e563cd11763","name":"تغريد","sales_type":"support"},
                 {"user_id":"5bb24a0f-43f8-49d5-b8a6-a84923d49bd3","name":"Manal","sales_type":"support"},
                 {"user_id":"175833e7-7bd1-42be-8826-776339dcd7be","name":"عواطف","sales_type":"office"}]
  }'::jsonb)
on conflict (org_id, setting_key) do nothing;
