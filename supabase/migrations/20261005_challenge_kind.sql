-- «التحديات والطلبات والتطويرات»: نفس مركز المعالجة يستقبل ثلاثة أنواع.
--   challenge         تحدٍّ يواجه الموظف (الافتراضي — كل السجلات الحالية)
--   customer_request  طلب عميل يحتاج حل
--   development       تطوير على النظام يحتاج متابعة لإنجازه
alter table public.employee_challenges
  add column if not exists kind text not null default 'challenge'
    check (kind in ('challenge', 'customer_request', 'development'));

-- اسم العميل لطلبات العملاء.
alter table public.employee_challenges
  add column if not exists client_name text;

create index if not exists employee_challenges_org_kind_idx
  on public.employee_challenges (org_id, kind, status);
