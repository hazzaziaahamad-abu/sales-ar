-- ─────────────────────────────────────────────────────────────────────────────
-- أتمتة «تذكرة بدون تحديث ٤٨ ساعة»: كل ساعة يستدعي /api/cron/stale-tickets
-- اللي يكتب تعليق باسم السوبر أدمن فيه منشن للموظف المسؤول يطلب تحديث
-- (تذاكر الدعم + الطلبات والتطويرات، في كل الأقسام). ما يرسل إلا وقت الدوام.
-- السر نفسه المخزّن في push_config (مثل focus-push).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  perform cron.unschedule('stale-tickets');
exception when others then null;
end $$;

select cron.schedule(
  'stale-tickets',
  '17 * * * *',  -- كل ساعة عند الدقيقة ١٧
  $$
  select net.http_post(
    url     := 'https://sales-ar-seven.vercel.app/api/cron/stale-tickets',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-push-secret', (select cron_secret from public.push_config where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
