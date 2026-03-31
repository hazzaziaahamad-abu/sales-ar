-- Employee Tasks table
CREATE TABLE employee_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid NOT NULL REFERENCES auth.users(id),
  assigned_to_name text NOT NULL,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_by_name text,
  due_date date,
  due_time time,
  start_date date DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  client_name text,
  client_phone text,
  entity_type text,
  entity_id uuid,
  notes text,
  completion_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_employee_tasks_org ON employee_tasks(org_id);
CREATE INDEX idx_employee_tasks_assigned ON employee_tasks(assigned_to);
CREATE INDEX idx_employee_tasks_status ON employee_tasks(status);
CREATE INDEX idx_employee_tasks_due ON employee_tasks(due_date);

ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON employee_tasks
  FOR ALL USING (true) WITH CHECK (true);
