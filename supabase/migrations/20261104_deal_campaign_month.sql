-- «شهر الحملة» للصفقات بمصدر «حملة اعلانية» — لقياس كل حملة بشهرها بدل شهر الدفع.
-- عمود جديد فارغ؛ الصفقات الحالية لا تتغير. الإلزام في نموذج الصفقة فقط.
alter table public.deals add column if not exists campaign_month text
  check (campaign_month is null or campaign_month ~ '^\d{4}-(0[1-9]|1[0-2])$');  -- YYYY-MM
create index if not exists idx_deals_campaign_month on public.deals (org_id, campaign_month) where campaign_month is not null;
