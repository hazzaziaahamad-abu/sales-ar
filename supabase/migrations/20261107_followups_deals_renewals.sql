-- ─────────────────────────────────────────────────────────────────────────────
-- توسيع «متابعة التذاكر الساكتة» لتشمل الصفقات (مبيعات المكتب + مبيعات الدعم) والتجديدات،
-- وحصرها في اللي آخر نشاط عليها بين ٤٨ ساعة و١٠ أيام (الأقدم ما ينجاب).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.ticket_followups drop constraint if exists ticket_followups_source_check;
alter table public.ticket_followups add constraint ticket_followups_source_check
  check (source in ('support', 'work', 'deal', 'renewal'));
-- القسم للعرض والفلترة: ticket / work / office_sales / support_sales / renewal
alter table public.ticket_followups add column if not exists category text;
update public.ticket_followups set category = case source when 'support' then 'ticket' else source end where category is null;

-- كل العناصر المفتوحة اللي لها موظف مسؤول، مع آخر نشاط (تحديث/تعليق) عليها.
create or replace function public.followup_items(p_source text default null, p_id uuid default null)
returns table (
  source text, category text, id uuid, org_id uuid, item_number integer, title text,
  assignee text, assignee_id uuid, last_activity timestamptz
)
language sql stable
set search_path = public
as $$
  select 'support', 'ticket', t.id, t.org_id, t.ticket_number, coalesce(nullif(t.client_name, ''), t.issue, ''),
         trim(t.assigned_agent_name), null::uuid,
         greatest(t.created_at, t.updated_at, t.reopened_at,
           (select max(n.created_at) from follow_up_notes n where n.entity_type = 'ticket' and n.entity_id = t.id))
  from tickets t
  where (p_source is null or p_source = 'support') and (p_id is null or t.id = p_id)
    and t.status not in ('محلول', 'مغلق') and coalesce(trim(t.assigned_agent_name), '') <> ''
  union all
  select 'work', 'work', w.id, w.org_id, w.ticket_number, coalesce(w.title, ''),
         trim(w.assigned_to_name), w.assigned_to,
         greatest(w.created_at, w.updated_at,
           (select max(e.created_at) from work_ticket_events e where e.ticket_id = w.id))
  from work_tickets w
  where (p_source is null or p_source = 'work') and (p_id is null or w.id = p_id)
    and w.status in ('open', 'in_progress') and coalesce(trim(w.assigned_to_name), '') <> ''
  union all
  select 'deal', case when d.sales_type = 'support' then 'support_sales' else 'office_sales' end,
         d.id, d.org_id, null::integer, coalesce(d.client_name, ''),
         trim(d.assigned_rep_name), null::uuid,
         greatest(d.created_at, d.updated_at, d.last_contact::timestamptz,
           (select max(n.created_at) from follow_up_notes n where n.entity_type = 'deal' and n.entity_id = d.id))
  from deals d
  where (p_source is null or p_source = 'deal') and (p_id is null or d.id = p_id)
    and d.stage not in ('مكتملة', 'مرفوض مع سبب', 'استهداف خاطئ', 'كنسل التجربة', 'غير مهتم')
    and (d.callback_date is null or d.callback_date <= now())   -- له موعد اتصال قادم ← ما نستعجله
    and coalesce(trim(d.assigned_rep_name), '') <> ''
  union all
  select 'renewal', 'renewal', r.id, r.org_id, null::integer, coalesce(r.customer_name, ''),
         trim(r.assigned_rep), null::uuid,
         greatest(r.created_at, r.updated_at,
           (select max(n.created_at) from follow_up_notes n where n.entity_type = 'renewal' and n.entity_id = r.id))
  from renewals r
  where (p_source is null or p_source = 'renewal') and (p_id is null or r.id = p_id)
    and r.status not in ('مكتمل', 'ملغي بسبب', 'إيقاف مؤقت', 'مؤجل مؤقتاً')
    and (r.renewal_date is null or r.renewal_date <= current_date + 7)   -- تجديد بعيد ← مو وقته
    and coalesce(trim(r.assigned_rep), '') <> ''
$$;

-- الساكتة: آخر نشاط بين min_hours و max_days.
create or replace function public.followup_stale_items(p_min_hours integer default 48, p_max_days integer default 10)
returns table (
  source text, category text, id uuid, org_id uuid, item_number integer, title text,
  assignee text, assignee_id uuid, last_activity timestamptz
)
language sql stable
set search_path = public
as $$
  select * from public.followup_items()
  where last_activity < now() - make_interval(hours => p_min_hours)
    and last_activity > now() - make_interval(days => p_max_days)
$$;

revoke all on function public.followup_items(text, uuid) from public, anon, authenticated;
revoke all on function public.followup_stale_items(integer, integer) from public, anon, authenticated;
grant execute on function public.followup_items(text, uuid) to service_role;
grant execute on function public.followup_stale_items(integer, integer) to service_role;

-- آخر تعليق لكل عنصر (الفهرس الموجود يبدأ بـ org_id فما يخدم الاستعلام)
create index if not exists idx_follow_up_notes_entity_latest on public.follow_up_notes (entity_type, entity_id, created_at desc);
