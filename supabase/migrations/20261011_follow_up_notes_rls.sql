-- حماية سجل المتابعة: الوصول للمستخدمين المسجّلين فقط (مطبّق على قاعدة البيانات 2026-10-11)
ALTER TABLE public.follow_up_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY follow_up_notes_select ON public.follow_up_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY follow_up_notes_insert ON public.follow_up_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY follow_up_notes_update ON public.follow_up_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY follow_up_notes_delete ON public.follow_up_notes FOR DELETE TO authenticated USING (true);
