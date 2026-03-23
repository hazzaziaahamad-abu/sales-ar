-- ============================================================
-- CommandCenter Full Schema Migration
-- ============================================================

-- 1. Organizations
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Insert default org
INSERT INTO organizations (id, name, name_ar) VALUES
  ('00000000-0000-0000-0000-000000000001', 'RESTAVO', 'رستافو');

-- 2. Roles
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  allowed_pages text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Default roles
INSERT INTO roles (name, slug, allowed_pages) VALUES
  ('مدير عام', 'super_admin', ARRAY['dashboard','sales','renewals','satisfaction','support','development','partnerships','team','finance','upload','agent','users']),
  ('مدير مبيعات', 'sales_manager', ARRAY['dashboard','sales','renewals','satisfaction','team','agent']),
  ('موظف دعم', 'support_agent', ARRAY['dashboard','support','agent']),
  ('مشاهد', 'viewer', ARRAY['dashboard']);

-- 3. User Profiles
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  role_id uuid REFERENCES roles(id),
  name text NOT NULL DEFAULT 'مستخدم',
  email text,
  is_super_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Deals
CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  client_name text NOT NULL,
  client_phone text,
  deal_value numeric NOT NULL DEFAULT 0,
  source text,
  stage text NOT NULL DEFAULT 'تواصل أولي',
  probability numeric DEFAULT 0,
  assigned_rep_id text,
  assigned_rep_name text,
  cycle_days integer DEFAULT 0,
  deal_date date,
  close_date date,
  plan text,
  loss_reason text,
  notes text,
  month integer,
  year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deals_org ON deals(org_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_month_year ON deals(month, year);

-- 5. Tickets
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  ticket_number serial,
  client_name text NOT NULL,
  client_phone text,
  issue text NOT NULL,
  priority text NOT NULL DEFAULT 'عادي',
  status text NOT NULL DEFAULT 'مفتوح',
  assigned_agent_id text,
  assigned_agent_name text,
  open_date date,
  due_date date,
  resolved_date date,
  response_time text,
  response_time_minutes integer,
  month integer,
  year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tickets_org ON tickets(org_id);
CREATE INDEX idx_tickets_status ON tickets(status);

-- 6. Employees
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  role text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'نشط',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_org ON employees(org_id);

-- 7. Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  team text,
  start_date date,
  progress integer DEFAULT 0,
  total_tasks integer DEFAULT 0,
  remaining_tasks integer DEFAULT 0,
  status_tag text DEFAULT 'في الموعد',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_projects_org ON projects(org_id);

-- 8. Partnerships
CREATE TABLE partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  type text,
  status text,
  value numeric DEFAULT 0,
  manager_name text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_partnerships_org ON partnerships(org_id);

-- 9. Reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  customer_name text NOT NULL,
  avatar text,
  stars integer NOT NULL DEFAULT 5 CHECK (stars >= 1 AND stars <= 5),
  type text NOT NULL DEFAULT 'satisfied' CHECK (type IN ('very_satisfied','satisfied','neutral','needs_improvement','unsatisfied')),
  category text,
  review_date date,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reviews_org ON reviews(org_id);

-- 10. Renewals
CREATE TABLE renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  customer_name text NOT NULL,
  customer_phone text,
  plan_name text NOT NULL,
  plan_price numeric DEFAULT 0,
  renewal_date date NOT NULL,
  status text NOT NULL DEFAULT 'مجدول',
  cancel_reason text,
  assigned_rep text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_renewals_org ON renewals(org_id);
CREATE INDEX idx_renewals_status ON renewals(status);
CREATE INDEX idx_renewals_date ON renewals(renewal_date);

-- 11. Excel Uploads
CREATE TABLE excel_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid,
  filename text NOT NULL,
  file_url text,
  sheets_count integer DEFAULT 0,
  deals_imported integer DEFAULT 0,
  tickets_imported integer DEFAULT 0,
  renewals_imported integer DEFAULT 0,
  status text DEFAULT 'completed',
  mapping_result jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE excel_uploads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_excel_uploads_org ON excel_uploads(org_id);

-- 12. KPI Snapshots
CREATE TABLE kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  month integer NOT NULL,
  year integer NOT NULL,
  total_revenue numeric DEFAULT 0,
  total_deals integer DEFAULT 0,
  closed_deals integer DEFAULT 0,
  close_rate numeric DEFAULT 0,
  avg_deal_value numeric DEFAULT 0,
  avg_cycle_days numeric DEFAULT 0,
  avg_probability numeric DEFAULT 0,
  target_revenue numeric DEFAULT 0,
  revenue_gap numeric DEFAULT 0,
  stage_contact integer DEFAULT 0,
  stage_quote integer DEFAULT 0,
  stage_negotiate integer DEFAULT 0,
  stage_closed integer DEFAULT 0,
  total_tickets integer DEFAULT 0,
  tickets_open integer DEFAULT 0,
  tickets_in_progress integer DEFAULT 0,
  tickets_resolved integer DEFAULT 0,
  tickets_urgent integer DEFAULT 0,
  tickets_high integer DEFAULT 0,
  tickets_normal integer DEFAULT 0,
  resolution_rate numeric DEFAULT 0,
  urgent_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, month, year)
);
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_kpi_org ON kpi_snapshots(org_id);

-- 13. Employee Scores
CREATE TABLE employee_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  overall_score numeric DEFAULT 0,
  close_rate_score numeric DEFAULT 0,
  revenue_score numeric DEFAULT 0,
  deal_count_score numeric DEFAULT 0,
  cycle_speed_score numeric DEFAULT 0,
  consistency_score numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  deals_won integer DEFAULT 0,
  total_deals integer DEFAULT 0,
  close_rate numeric DEFAULT 0,
  avg_deal_value numeric DEFAULT 0,
  avg_cycle_days numeric DEFAULT 0,
  ai_summary text,
  ai_strengths jsonb,
  ai_improvements jsonb,
  ai_tip text,
  ai_forecast text,
  ai_comparison jsonb,
  ai_analyzed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scores_org ON employee_scores(org_id);
CREATE INDEX idx_scores_employee ON employee_scores(employee_id);

-- 14. Alerts
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL CHECK (type IN ('critical','warning','opportunity')),
  category text NOT NULL,
  message text NOT NULL,
  employee_id uuid,
  deal_id uuid,
  ticket_id uuid,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alerts_org ON alerts(org_id);

-- ============================================================
-- RLS Policies — allow all via service_role, org-scoped via anon
-- ============================================================

-- Helper: org-scoped policies for each data table
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'deals','tickets','employees','projects','partnerships',
    'reviews','renewals','excel_uploads','kpi_snapshots',
    'employee_scores','alerts'
  ]) LOOP
    EXECUTE format('
      CREATE POLICY "service_role_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);
      CREATE POLICY "anon_select" ON %I FOR SELECT TO anon, authenticated USING (true);
      CREATE POLICY "anon_insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);
      CREATE POLICY "anon_update" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
      CREATE POLICY "anon_delete" ON %I FOR DELETE TO anon, authenticated USING (true);
    ', tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Auth-related tables policies
CREATE POLICY "service_role_all" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "read_orgs" ON organizations FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "service_role_all" ON roles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "read_roles" ON roles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "service_role_all" ON user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "read_profiles" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- Trigger: auto-create user_profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role_id uuid;
BEGIN
  SELECT id INTO default_role_id FROM roles WHERE slug = 'viewer' LIMIT 1;
  INSERT INTO user_profiles (id, email, name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'مستخدم'),
    default_role_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
