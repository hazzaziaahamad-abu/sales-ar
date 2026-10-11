-- تذكيرات الفريق: تسجيل تفاعل الموظف مع كل تذكير (مطبّق 2026-10-11)
CREATE TABLE IF NOT EXISTS public.team_reminder_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  reminder_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('start','mid')),
  item_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('done','dismissed')),
  metric integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, reminder_date, slot, item_key)
);
CREATE INDEX IF NOT EXISTS team_reminder_acks_org_date ON public.team_reminder_acks (org_id, reminder_date);
ALTER TABLE public.team_reminder_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_reminder_acks_select ON public.team_reminder_acks FOR SELECT TO authenticated USING (true);
CREATE POLICY team_reminder_acks_insert ON public.team_reminder_acks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY team_reminder_acks_update ON public.team_reminder_acks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
