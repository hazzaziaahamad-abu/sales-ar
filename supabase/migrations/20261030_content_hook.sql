-- التسويق بالمحتوى: «هوك المحتوى» — الجملة اللي توقف السكرول في أول 3 ثواني (من مكتبة الهوكات أو مكتوبة يدوياً).
alter table public.content_items add column if not exists hook text not null default '';
alter table public.content_suggestions add column if not exists hook text not null default '';
