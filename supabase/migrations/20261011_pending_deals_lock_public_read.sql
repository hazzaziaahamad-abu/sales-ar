-- pending_deals: الزائر (صفحة /submit) يضيف طلباً معلّقاً فقط ولا يقرأ (مطبّق 2026-10-11)
ALTER POLICY "Allow authenticated read" ON public.pending_deals TO authenticated;
ALTER POLICY "Allow public insert" ON public.pending_deals TO anon, authenticated WITH CHECK (status = 'pending');
