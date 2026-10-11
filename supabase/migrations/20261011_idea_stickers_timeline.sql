-- «أفكار»: تايم لاين التنفيذ لكل فكرة.
-- timeline: مصفوفة خطوات [{ key, label, done_at, done_by }] — تُعبّأ بالخطوات الافتراضية عند أول تعديل.
-- due_at: موعد التنفيذ المستهدف (للالتزام بالموعد).
alter table public.idea_stickers add column if not exists timeline jsonb not null default '[]'::jsonb;
alter table public.idea_stickers add column if not exists due_at date;
