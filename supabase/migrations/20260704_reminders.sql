create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  entity_type text not null,
  entity_id text not null,
  entity_name text not null,
  note_text text,
  remind_at timestamptz not null,
  dismissed boolean default false,
  created_at timestamptz default now()
);

alter table reminders enable row level security;

create policy "Users manage own reminders" on reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists reminders_user_due on reminders(user_id, remind_at) where dismissed = false;
