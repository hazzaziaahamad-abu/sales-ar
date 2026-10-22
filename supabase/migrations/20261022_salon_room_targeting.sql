-- ─────────────────────────────────────────────────────────────────────────────
-- غرفة التخطيط والتنفيذ: خطة الاستهداف + أهداف الفريق الأسبوعية.
--   consult_clients: حقول الاستهداف للصالونات المرشّحة (stage = 'lead').
--   consult_logs.kind: إضافة 'contact' (محاولة تواصل مع صالون مستهدف).
--   consult_room_settings.targets: أهداف الأسبوع { contacts, meetings, contracts }.
-- إضافات فقط — القيم الافتراضية لا تغيّر أي بيانات قائمة.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.consult_clients add column if not exists source text;
alter table public.consult_clients add column if not exists priority text not null default 'B';
alter table public.consult_clients add column if not exists segment text;
alter table public.consult_clients add column if not exists lead_status text not null default 'new';
alter table public.consult_clients add column if not exists last_contact_at timestamptz;
alter table public.consult_clients add column if not exists next_followup date;
alter table public.consult_clients add column if not exists converted_at timestamptz;

alter table public.consult_clients drop constraint if exists consult_clients_priority_check;
alter table public.consult_clients add constraint consult_clients_priority_check check (priority in ('A', 'B', 'C'));
alter table public.consult_clients drop constraint if exists consult_clients_lead_status_check;
alter table public.consult_clients add constraint consult_clients_lead_status_check
  check (lead_status in ('new', 'contacted', 'interested', 'meeting', 'not_interested'));

alter table public.consult_logs drop constraint if exists consult_logs_kind_check;
alter table public.consult_logs add constraint consult_logs_kind_check
  check (kind in ('note', 'checkin', 'meeting', 'stage', 'contact'));

alter table public.consult_room_settings add column if not exists targets jsonb not null default '{}'::jsonb;

-- تاريخ التعاقد: أول دخول للعميل لمرحلة التأسيس أو بعدها (لعدّ التعاقدات أسبوعياً)
alter table public.consult_clients add column if not exists contracted_at timestamptz;
