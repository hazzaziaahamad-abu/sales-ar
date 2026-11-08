-- سرعة الرد على التذاكر: وقت أول رد يُسجَّل تلقائياً.
-- أول رد = أول ملاحظة في «سجل المتابعة» على التذكرة، أو أول تغيير لحالتها من «مفتوح».
-- نحسب فقط للتذاكر المفتوحة من تاريخ التفعيل وبعده (القديمة ما لها وقت فتح دقيق).
-- وكذلك: تاريخ الحل (resolved_date) ما كان يتسجّل أبداً عند تحويل التذكرة لـ«محلول» — صار تلقائي.
alter table public.tickets add column if not exists first_response_at timestamptz;

create or replace function public.ticket_mark_first_response(p_ticket uuid, p_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tickets t
     set first_response_at = p_at,
         response_time_minutes = greatest(0, round(extract(epoch from (p_at - t.created_at)) / 60))::int
   where t.id = p_ticket
     and t.first_response_at is null
     and t.created_at >= timestamptz '2026-11-08 00:00:00+03';
end $$;

create or replace function public.trg_note_first_response()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity_type = 'ticket' then
    perform public.ticket_mark_first_response(new.entity_id, new.created_at);
  end if;
  return new;
end $$;

drop trigger if exists follow_up_notes_first_response on public.follow_up_notes;
create trigger follow_up_notes_first_response
  after insert on public.follow_up_notes
  for each row execute function public.trg_note_first_response();

create or replace function public.trg_ticket_status_first_response()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'محلول' and old.status is distinct from 'محلول' and new.resolved_date is null then
    new.resolved_date := (now() at time zone 'Asia/Riyadh')::date;
  end if;
  if new.first_response_at is null and old.status = 'مفتوح' and new.status is distinct from old.status
     and new.created_at >= timestamptz '2026-11-08 00:00:00+03' then
    new.first_response_at := now();
    new.response_time_minutes := greatest(0, round(extract(epoch from (now() - new.created_at)) / 60))::int;
  end if;
  return new;
end $$;

drop trigger if exists tickets_status_first_response on public.tickets;
create trigger tickets_status_first_response
  before update of status on public.tickets
  for each row execute function public.trg_ticket_status_first_response();

revoke execute on function public.ticket_mark_first_response(uuid, timestamptz) from public, anon, authenticated;
