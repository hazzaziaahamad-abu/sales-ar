-- ─────────────────────────────────────────────────────────────────────────────
-- «ورقة تطوير» في لوحة الأفكار: نوع استكر جديد (dev) بمراحل تطوير، ملاحظات اجتماع
-- (نص بعلامات التظليل نفسها في ملاحظات اجتماع إدارة المستشارين)، وشرائح.
-- توسيع قيد النوع + عمود ملاحظات فقط — بدون أي تعديل على البيانات الحالية.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.idea_stickers drop constraint if exists idea_stickers_kind_check;
alter table public.idea_stickers
  add constraint idea_stickers_kind_check check (kind in ('star', 'note', 'circle', 'dev'));

alter table public.idea_stickers add column if not exists notes text not null default '';
