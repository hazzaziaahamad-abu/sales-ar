-- «التسويق الرقمي والحملات» لكل صالون في «إدارة مستشاري الصالونات»:
--   consult_clients.marketing: { readiness: {id: bool}, campaigns: [{id, name, platform, status, spend, bookings, …}] }
alter table public.consult_clients add column if not exists marketing jsonb not null default '{}'::jsonb;
