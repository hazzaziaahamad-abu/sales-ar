-- التسويق بالمحتوى: تايم لاين الفيديو + نقاط التركيز أثناء التصوير.
-- timeline: [{ time: "0-3ث", shot: "اللقطة/المشهد", voice: "الكلام/التعليق", text: "نص على الشاشة" }]
-- focus_points: ["نقطة تركيز", ...]
alter table public.content_items add column if not exists timeline jsonb not null default '[]'::jsonb;
alter table public.content_items add column if not exists focus_points jsonb not null default '[]'::jsonb;
