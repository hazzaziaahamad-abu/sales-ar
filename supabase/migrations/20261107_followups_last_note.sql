-- آخر تعليق على كل عنصر في «متابعة التذاكر والصفقات» — يظهر للسوبر أدمن قبل الموافقة.
create or replace function public.followup_last_notes(p_ids uuid[])
returns table (item_id uuid, author text, body text, created_at timestamptz)
language sql stable
set search_path = public
as $$
  select * from (
    select distinct on (n.entity_id) n.entity_id, n.author_name, n.note, n.created_at
    from follow_up_notes n
    where n.entity_id = any(p_ids)
    order by n.entity_id, n.created_at desc
  ) f
  union all
  select * from (
    select distinct on (e.ticket_id) e.ticket_id, e.actor_name, e.body, e.created_at
    from work_ticket_events e
    where e.ticket_id = any(p_ids) and coalesce(e.body, '') <> ''
    order by e.ticket_id, e.created_at desc
  ) w
$$;

revoke all on function public.followup_last_notes(uuid[]) from public, anon, authenticated;
grant execute on function public.followup_last_notes(uuid[]) to service_role;
