-- «أفكار»: التذكير له موعد إنجاز وحالة (مكتمل / غير مكتمل) بدل خطوات التنفيذ.
-- completed_at: وقت إنجاز التذكير — المكتمل ينتقل للوحة «المنجزات».
alter table public.idea_stickers add column if not exists completed_at timestamptz;
alter table public.idea_stickers add column if not exists completed_by text;
