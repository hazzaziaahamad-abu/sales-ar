-- دمج «مبيعات الدعم» مع «المبيعات» (وتجديدات الدعم مع تجديدات المكتب):
-- كل صف sales_type = 'support' يصير 'office'.
-- نحفظ نسخة من المعرّفات الأصلية في support_merge_backup للتراجع عند الحاجة.

CREATE TABLE IF NOT EXISTS support_merge_backup (
  table_name text NOT NULL,
  row_id     text NOT NULL,
  row_data   jsonb,
  merged_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_merge_backup ENABLE ROW LEVEL SECURITY;

INSERT INTO support_merge_backup (table_name, row_id)
  SELECT 'deals', id::text FROM deals WHERE sales_type = 'support'
  UNION ALL SELECT 'pending_deals', id::text FROM pending_deals WHERE sales_type = 'support'
  UNION ALL SELECT 'renewals', id::text FROM renewals WHERE sales_type = 'support'
  UNION ALL SELECT 'targeting_clients', id::text FROM targeting_clients WHERE sales_type = 'support'
  UNION ALL SELECT 'employee_daily_goals', id::text FROM employee_daily_goals WHERE sales_type = 'support';

-- تعهدات العروض: صف الدعم المكرر لنفس الموظف/اليوم مع صف المكتب يُحذف (نحفظه كامل قبل الحذف)
INSERT INTO support_merge_backup (table_name, row_id, row_data)
  SELECT 'quote_commitments', s.id::text, to_jsonb(s)
  FROM quote_commitments s
  WHERE s.sales_type = 'support';

DELETE FROM quote_commitments s
  USING quote_commitments o
  WHERE s.sales_type = 'support' AND o.sales_type = 'office'
    AND s.org_id = o.org_id AND s.user_name = o.user_name AND s.quote_date = o.quote_date;

DELETE FROM employee_daily_goals s
  USING employee_daily_goals o
  WHERE s.sales_type = 'support' AND o.sales_type = 'office'
    AND s.org_id = o.org_id AND s.rep_name = o.rep_name AND s.goal_date = o.goal_date;

UPDATE deals                SET sales_type = 'office' WHERE sales_type = 'support';
UPDATE pending_deals        SET sales_type = 'office' WHERE sales_type = 'support';
UPDATE renewals             SET sales_type = 'office' WHERE sales_type = 'support';
UPDATE targeting_clients    SET sales_type = 'office' WHERE sales_type = 'support';
UPDATE quote_commitments    SET sales_type = 'office' WHERE sales_type = 'support';
UPDATE employee_daily_goals SET sales_type = 'office' WHERE sales_type = 'support';

ALTER TABLE renewals ALTER COLUMN sales_type SET DEFAULT 'office';
