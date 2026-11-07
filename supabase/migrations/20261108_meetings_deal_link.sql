-- «الاجتماعات» ↔ «اجتماعات العملاء»: موعد التقويم يرتبط بصفقة العميل وبرابط «خطة الاجتماع»،
-- عشان التقرير يحسب الاجتماعات اللي تمّت فعلاً ويقيس التحويل والترقية من الصفقة.
alter table public.meetings add column if not exists deal_id uuid references deals(id) on delete set null;
alter table public.meetings add column if not exists client_meeting_id uuid references client_meetings(id) on delete set null;
create index if not exists meetings_deal_idx on public.meetings (deal_id);
create index if not exists meetings_client_meeting_idx on public.meetings (client_meeting_id);
