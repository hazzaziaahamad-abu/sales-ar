-- المنافسين: السحب صار داخلي (بدون Apify) — مصدر اللقطة 'auto' بدل 'apify'.
alter table public.content_competitor_snapshots drop constraint if exists content_competitor_snapshots_source_check;
update public.content_competitor_snapshots set source = 'auto' where source = 'apify';
alter table public.content_competitor_snapshots alter column source set default 'auto';
alter table public.content_competitor_snapshots add constraint content_competitor_snapshots_source_check check (source in ('auto', 'manual'));
