-- مرحلة العميل/حالة العنصر الحالية لكل عنصر في «متابعة التذاكر والصفقات».
create or replace function public.followup_item_stages(p_ids uuid[])
returns table (item_id uuid, stage text)
language sql stable
set search_path = public
as $$
  select id, stage from deals where id = any(p_ids)
  union all select id, status from renewals where id = any(p_ids)
  union all select id, status from tickets where id = any(p_ids)
  union all select id, case status when 'open' then 'مفتوحة' when 'in_progress' then 'قيد التنفيذ'
                                   when 'done' then 'منجزة' when 'cancelled' then 'ملغاة' else status end
            from work_tickets where id = any(p_ids)
$$;

revoke all on function public.followup_item_stages(uuid[]) from public, anon, authenticated;
grant execute on function public.followup_item_stages(uuid[]) to service_role;
