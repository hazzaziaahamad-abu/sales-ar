-- ─────────────────────────────────────────────────────────────────────────────
-- «البذور»: أفكار شخصية يرميها المستخدم بسرعة ثم تكبر: بذرة ← برعم ← شجرة (لها خطة) ← ثمرة (نُفّذت).
-- «ذبلت» = حذف ناعم (wilted_at) يقدر يتراجع عنه، والحذف النهائي من قسم الذابلة.
-- كل فكرة خاصة بصاحبها. الوصول عبر مسارات الـ API (service role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  text text not null,
  notes text,
  stage text not null default 'seed'
    check (stage in ('seed', 'sprout', 'tree', 'fruit')),
  plan jsonb not null default '[]'::jsonb,     -- [{ text, done }]
  touches int not null default 0,              -- كم مرة رجع لها (حرارة الفكرة)
  last_touched_at timestamptz not null default now(),
  wilted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ideas_owner_idx on public.ideas (org_id, user_id, created_at desc);

alter table public.ideas enable row level security;
