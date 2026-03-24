-- ============================================================
-- Sales Performance Guide Tables
-- ============================================================

-- 1. Sales Activities (daily activity log per rep)
CREATE TABLE sales_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  activity_type text NOT NULL CHECK (activity_type IN ('call','demo','followup','meeting','quote','whatsapp')),
  result text CHECK (result IN ('positive','pending','no_answer','negative')),
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  client_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_activities_org ON sales_activities(org_id);
CREATE INDEX idx_sales_activities_date ON sales_activities(activity_date);
CREATE INDEX idx_sales_activities_employee ON sales_activities(employee_id);

CREATE POLICY "sales_activities_all" ON sales_activities FOR ALL USING (true) WITH CHECK (true);

-- 2. Sales Targets (configurable targets per period)
CREATE TABLE sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  period_type text NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  target_key text NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  min_value numeric NOT NULL DEFAULT 0,
  label_ar text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, period_type, target_key)
);
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_targets_org ON sales_targets(org_id);

CREATE POLICY "sales_targets_all" ON sales_targets FOR ALL USING (true) WITH CHECK (true);

-- Insert default targets
INSERT INTO sales_targets (org_id, period_type, target_key, target_value, min_value, label_ar) VALUES
  ('00000000-0000-0000-0000-000000000001', 'daily', 'calls', 15, 8, 'مكالمات يومية'),
  ('00000000-0000-0000-0000-000000000001', 'daily', 'followups', 10, 5, 'متابعات يومية'),
  ('00000000-0000-0000-0000-000000000001', 'weekly', 'demos', 5, 3, 'عروض أسبوعية'),
  ('00000000-0000-0000-0000-000000000001', 'weekly', 'quotes', 8, 4, 'عروض أسعار أسبوعية'),
  ('00000000-0000-0000-0000-000000000001', 'monthly', 'deals_closed', 10, 5, 'صفقات مغلقة شهريا'),
  ('00000000-0000-0000-0000-000000000001', 'monthly', 'revenue', 200000, 100000, 'إيراد شهري');

-- 3. Rep Weekly Scores (gamification leaderboard)
CREATE TABLE rep_weekly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  level text CHECK (level IN ('excellent','advanced','good','needs_improvement','danger')),
  calls_count integer DEFAULT 0,
  demos_count integer DEFAULT 0,
  followups_count integer DEFAULT 0,
  quotes_sent integer DEFAULT 0,
  deals_closed integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE rep_weekly_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rep_weekly_scores_org ON rep_weekly_scores(org_id);
CREATE INDEX idx_rep_weekly_scores_week ON rep_weekly_scores(week_start);

CREATE POLICY "rep_weekly_scores_all" ON rep_weekly_scores FOR ALL USING (true) WITH CHECK (true);

-- 4. PIP Plans (Performance Improvement Plans)
CREATE TABLE pip_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','cancelled')),
  current_week integer DEFAULT 1,
  week1_notes text,
  week2_notes text,
  week3_notes text,
  week4_notes text,
  target_percentage numeric DEFAULT 0,
  actual_percentage numeric DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE pip_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pip_plans_org ON pip_plans(org_id);
CREATE INDEX idx_pip_plans_status ON pip_plans(status);

CREATE POLICY "pip_plans_all" ON pip_plans FOR ALL USING (true) WITH CHECK (true);
