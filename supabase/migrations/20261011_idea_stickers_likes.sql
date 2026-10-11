-- «أفكار»: إعجابات الفريق على كل استكر (قائمة معرّفات المستخدمين — كل مستخدم مرة وحدة).
alter table public.idea_stickers add column if not exists likes uuid[] not null default '{}';
