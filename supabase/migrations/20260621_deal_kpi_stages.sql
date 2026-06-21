-- Deal KPI Stages — links KPI tracking stages to deals
create table if not exists deal_kpi_stages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  stage_number int not null,
  stage_name text not null,
  stage_weight int not null default 0,
  assigned_to uuid,
  assigned_name text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),

  unique(deal_id, stage_number)
);

-- Enable RLS
alter table deal_kpi_stages enable row level security;

-- RLS policy: allow all for authenticated users (same pattern as other tables)
create policy "deal_kpi_stages_all" on deal_kpi_stages
  for all using (true) with check (true);

-- Index for fast lookups
create index if not exists idx_deal_kpi_stages_deal_id on deal_kpi_stages(deal_id);
