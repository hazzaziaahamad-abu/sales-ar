create table if not exists manager_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  entity_type text not null,   -- deal | renewal | ticket
  entity_id text not null,
  entity_name text not null,
  section text not null,        -- /sales | /renewals | /support | /support-sales
  note text,
  resolved boolean default false,
  created_at timestamptz default now(),
  unique (user_id, entity_id)
);
alter table manager_watchlist enable row level security;
create policy "Managers manage own watchlist" on manager_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
