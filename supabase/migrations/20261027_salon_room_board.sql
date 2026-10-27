-- ─────────────────────────────────────────────────────────────────────────────
-- «جدول المهام للمستشارين» 📌 في «إدارة مستشاري الصالونات»: مهام عامة للفريق
-- (متابعة المنافسين، تقييم أفكار جديدة، محتوى، تدريب…) غير مرتبطة بصالون معيّن.
--   steps: خطوات التنفيذ [{key, label, done_at, done_by}] — منها نحسب التقدّم.
--   updates: تحديثات التقدّم [{id, body, author, at}].
-- إضافة جدول جديد فقط. الوصول عبر مسارات /api/salon-room (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.consult_board_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category text not null default 'other',
  title text not null,
  body text not null default '',
  assignee text,
  priority text not null default 'B' check (priority in ('A', 'B', 'C')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  due_date date,
  steps jsonb not null default '[]'::jsonb,
  updates jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_by text,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consult_board_tasks_org_idx on public.consult_board_tasks (org_id, status, sort_order);
alter table public.consult_board_tasks enable row level security;
