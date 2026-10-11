-- قفل الجداول الداخلية على المستخدمين المسجّلين فقط (مطبّق على قاعدة البيانات 2026-10-11)
-- مستثنى: organizations و roles (قراءة فقط)، gift_offers (قراءة/تحديث لصفحة /gift)،
-- pending_deals (إضافة/قراءة لصفحة /submit).
-- للتراجع عن سياسة معيّنة: ALTER POLICY "<اسم السياسة>" ON public.<الجدول> TO anon, authenticated;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND roles && '{anon,public}'::name[]
      AND tablename NOT IN ('organizations','roles')
      AND NOT (tablename = 'gift_offers'   AND cmd IN ('SELECT','UPDATE'))
      AND NOT (tablename = 'pending_deals' AND cmd IN ('SELECT','INSERT'))
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;
