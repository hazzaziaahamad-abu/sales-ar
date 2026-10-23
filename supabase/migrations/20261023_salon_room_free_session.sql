-- ─────────────────────────────────────────────────────────────────────────────
-- غرفة التخطيط والتنفيذ: «جلسة تشخيص نمو الصالون» المجانية لاستقطاب العملاء.
--   free_session: { is_free, session_date, qual{fit,owner,data}, booked_at, booked_by,
--                   held_at, findings[3], quick_win, proposal_sent_at, declined }
--   إعدادات الجلسة (القيمة المعلنة، التكلفة، السقف الأسبوعي) داخل consult_room_settings.targets.
-- إضافة عمود فقط.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.consult_clients add column if not exists free_session jsonb not null default '{}'::jsonb;
