-- ─────────────────────────────────────────────────────────────────────────────
-- «من أضاف الرقم» منفصل عن «الموظف الموكل له المبيعة» (assigned_rep_name).
-- فيه من يضيف الرقم فقط، ومختص مبيعات توكل له المبيعة وتُحتسب له.
-- إضافات فقط: الصفقات السابقة كان المسؤول فيها هو من أضافها، فننسخه.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.deals add column if not exists added_by_name text;

update public.deals set added_by_name = assigned_rep_name
where added_by_name is null and assigned_rep_name is not null;
