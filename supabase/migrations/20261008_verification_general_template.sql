-- «طلب عام»: المدير يرسل طلب بدون نوع تقرير، والموظف يختار اللي بيشتغل عليه.
-- بعد الاختيار يتحوّل القالب للنوع المختار (params.general = true، params.chosen_at = وقت الاختيار).
alter table public.verification_requests drop constraint if exists verification_requests_template_check;
alter table public.verification_requests add constraint verification_requests_template_check
  check (template in ('general', 'trial', 'awaiting_payment', 'stale', 'renewals_week', 'renewals_awaiting_payment', 'renewals_following_stale'));
