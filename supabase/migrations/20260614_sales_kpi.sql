-- جدول العملاء المحتملين (Leads)
CREATE TABLE IF NOT EXISTS sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  client_name text NOT NULL,
  phone text,
  source text DEFAULT 'whatsapp',
  status text DEFAULT 'new',
  product text,
  package_name text,
  deal_value numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مراحل المبيعة مع نسب الكريديت
CREATE TABLE IF NOT EXISTS sales_lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES sales_leads(id) ON DELETE CASCADE,
  stage_number int NOT NULL,
  stage_name text NOT NULL,
  stage_weight int NOT NULL,
  assigned_to text,
  assigned_name text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- مراحل البيع المرجعية (ثابتة)
CREATE TABLE IF NOT EXISTS sales_stage_definitions (
  stage_number int PRIMARY KEY,
  stage_name text NOT NULL,
  stage_name_en text,
  weight int NOT NULL,
  is_critical boolean DEFAULT false,
  description text
);

-- جدول ملخص الكريديت
CREATE TABLE IF NOT EXISTS sales_kpi_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id text,
  user_name text,
  period_month int,
  period_year int,
  leads_opened int DEFAULT 0,
  stages_completed int DEFAULT 0,
  deals_closed int DEFAULT 0,
  total_credit_points numeric(6,2) DEFAULT 0,
  total_deal_value numeric(10,2) DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_response_time_minutes int,
  updated_at timestamptz DEFAULT now()
);

-- إدخال المراحل الثابتة
INSERT INTO sales_stage_definitions VALUES
  (1, 'أول تواصل',     'First Contact',    10, false, 'أول رد على العميل عبر واتساب أو مكالمة'),
  (2, 'تأهيل وعرض',   'Qualify & Offer',  15, false, 'فهم الاحتياج وإرسال العرض المناسب'),
  (3, 'اختيار الباقة', 'Package Selected', 30, true,  'العميل اختار وتأكد من الباقة المناسبة'),
  (4, 'الدفع',         'Payment',          30, true,  'تم استلام الدفع وتأكيده'),
  (5, 'تأكيد التسجيل', 'Activation',       15, true,  'تم تفعيل الحساب وتسليمه للعميل')
ON CONFLICT (stage_number) DO NOTHING;

-- فهارس
CREATE INDEX IF NOT EXISTS sales_leads_org_idx ON sales_leads(org_id);
CREATE INDEX IF NOT EXISTS sales_leads_status_idx ON sales_leads(status);
CREATE INDEX IF NOT EXISTS sales_lead_stages_lead_idx ON sales_lead_stages(lead_id);

-- RLS
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_kpi_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_stage_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_access" ON sales_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "all_access_service" ON sales_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON sales_lead_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "all_access_service" ON sales_lead_stages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON sales_kpi_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "all_access_service" ON sales_kpi_summary FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON sales_stage_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_access_service" ON sales_stage_definitions FOR ALL TO service_role USING (true) WITH CHECK (true);
