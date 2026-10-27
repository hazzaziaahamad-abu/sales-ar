-- ─────────────────────────────────────────────────────────────────────────────
-- «اجتماع الفريق» 🗓️ في «إدارة مستشاري الصالونات»: أجندة الاجتماع وتدوين ملاحظاته.
--   agenda: بنود الأجندة [{id, title, owner, minutes, done, notes, source}]
--   attendees: أسماء الحاضرات، decisions: القرارات [{id, body}]
--   actions: المهام الناتجة [{id, body, assignee, due_date, task_id}] — task_id لو تحوّلت لـ«جدول المهام».
-- إضافة جدول جديد فقط. الوصول عبر مسارات /api/salon-room (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.consult_meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  kind text not null default 'weekly' check (kind in ('weekly', 'monthly', 'urgent', 'other')),
  meeting_date date not null,
  start_time text,
  status text not null default 'planned' check (status in ('planned', 'held')),
  facilitator text,
  attendees jsonb not null default '[]'::jsonb,
  agenda jsonb not null default '[]'::jsonb,
  notes text not null default '',
  decisions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consult_meetings_org_idx on public.consult_meetings (org_id, meeting_date desc);
alter table public.consult_meetings enable row level security;
