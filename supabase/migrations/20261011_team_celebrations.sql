-- احتفالات الفريق: إعلان إنجاز الموظف لكل الفريق (مطبّق 2026-10-11)
CREATE TABLE IF NOT EXISTS public.team_celebrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  celebration_date date NOT NULL,
  slot text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, celebration_date, slot)
);
CREATE INDEX IF NOT EXISTS team_celebrations_org_date ON public.team_celebrations (org_id, celebration_date);
ALTER TABLE public.team_celebrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_celebrations_select ON public.team_celebrations FOR SELECT TO authenticated USING (true);
CREATE POLICY team_celebrations_insert ON public.team_celebrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_celebrations;
