-- قسم «التجديدات» في طلبات التحقق.
alter table public.verification_requests drop constraint if exists verification_requests_scope_check;
alter table public.verification_requests add constraint verification_requests_scope_check
  check (scope in ('support', 'office', 'all', 'renewals'));
