-- قوالب تحقق إضافية للتجديدات.
alter table public.verification_requests drop constraint if exists verification_requests_template_check;
alter table public.verification_requests add constraint verification_requests_template_check
  check (template in ('trial', 'awaiting_payment', 'stale', 'renewals_week', 'renewals_awaiting_payment', 'renewals_following_stale'));
