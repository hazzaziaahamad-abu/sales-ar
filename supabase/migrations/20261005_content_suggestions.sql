-- التسويق بالمحتوى: حفظ أفكار الذكاء الاصطناعي المولّدة حتى تبقى بعد إعادة فتح الصفحة،
-- وكل توليد جديد يُضاف للقائمة (ولا يكرر ما سبق).
create table if not exists public.content_suggestions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.content_plans(id) on delete cascade,
  kind text not null default 'video' check (kind in ('video','reel','post','carousel','story')),
  title text not null default '',
  idea text not null default '',
  script text not null default '',
  caption text not null default '',
  timeline jsonb not null default '[]'::jsonb,
  focus_points jsonb not null default '[]'::jsonb,
  hint text not null default '',               -- التوجيه المستخدم وقت التوليد
  added boolean not null default false,        -- أُضيفت للخطة كعنصر محتوى
  created_at timestamptz not null default now()
);
create index if not exists content_suggestions_plan_idx on public.content_suggestions (plan_id, created_at desc);
alter table public.content_suggestions enable row level security;
