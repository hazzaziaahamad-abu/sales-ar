-- التذكيرات الآلية: تحليل ذكي قبل التجهيز + أيام التذكير (السبت والاثنين والخميس فقط).
--   ai_priority: high / normal — أولوية العنصر حسب التحليل.
--   ai_reason:   سبب قصير ليش يحتاج (أو ما يحتاج) إجراء — يظهر للسوبر أدمن قبل الموافقة.
alter table public.ticket_followups add column if not exists ai_priority text
  check (ai_priority is null or ai_priority in ('high', 'normal'));
alter table public.ticket_followups add column if not exists ai_reason text;
