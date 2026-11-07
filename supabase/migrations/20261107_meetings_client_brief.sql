-- «الاجتماعات»: تفاصيل اجتماع العميل (Google Meet) — بيانات العميل وملاحظات كل محور
-- (الترحيب، سؤال العميل، ملخص المنصة، المنافسين) وأي المحاور تمت.
alter table public.meetings add column if not exists client_brief jsonb;
