-- «اجتماع الفريق»: أجندة افتراضية يعدّلها الفريق لكل نوع اجتماع (تحلّ محل القالب المدمج).
--   consult_room_settings.meeting_templates: { weekly: [{title, minutes, owner}], monthly: [...], ... }
alter table public.consult_room_settings add column if not exists meeting_templates jsonb not null default '{}'::jsonb;
