-- محادثات الإدارة: شات داخلي بين المؤسس/الإدارة والموظف مربوط بصفقة/تجديد/عميل.
create table if not exists public.management_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  entity_type text not null check (entity_type in ('deal', 'renewal', 'client')),
  entity_id text not null,
  entity_name text,
  sender_id uuid,
  sender_name text not null,
  recipient_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists management_messages_entity_idx
  on public.management_messages (org_id, entity_type, entity_id, created_at);
create index if not exists management_messages_recipient_idx
  on public.management_messages (org_id, recipient_name, created_at);

alter table public.management_messages enable row level security;

-- أي مستخدم مسجّل دخوله يقرأ ويكتب (التصفية بالمؤسسة تتم في الاستعلام، كبقية الجداول).
drop policy if exists "management_messages_select" on public.management_messages;
create policy "management_messages_select" on public.management_messages
  for select to authenticated using (true);

drop policy if exists "management_messages_insert" on public.management_messages;
create policy "management_messages_insert" on public.management_messages
  for insert to authenticated with check (true);
