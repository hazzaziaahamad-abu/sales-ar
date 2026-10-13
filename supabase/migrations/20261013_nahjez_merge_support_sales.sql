-- نحجز (حجوزات) فقط: دمج «مبيعات الدعم» مع «المبيعات».
-- قائمة الطلبات (…0001) لا تتغيّر إطلاقاً.
-- نحفظ معرّفات الصفوف المحوّلة في support_merge_backup للتراجع عند الحاجة.

CREATE TABLE IF NOT EXISTS support_merge_backup (
  table_name text NOT NULL,
  row_id     text NOT NULL,
  row_data   jsonb,
  merged_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_merge_backup ENABLE ROW LEVEL SECURITY;
-- نسخة تجريبية سابقة للجدول احتوت معرّفات من المنظمتين (بدون أي تعديل على البيانات) — نبدأ نظيفين
DELETE FROM support_merge_backup;

INSERT INTO support_merge_backup (table_name, row_id)
  SELECT 'deals', id::text FROM deals
   WHERE org_id::text = '00000000-0000-0000-0000-000000000002' AND sales_type = 'support';
INSERT INTO support_merge_backup (table_name, row_id, row_data)
  SELECT 'quote_commitments', id::text, to_jsonb(q) FROM quote_commitments q
   WHERE org_id::text = '00000000-0000-0000-0000-000000000002' AND sales_type = 'support';

-- تعهد عرض «دعم» مكرر لنفس الموظف/اليوم مع تعهد «مكتب» يُحذف (محفوظ كامل في النسخة الاحتياطية)
DELETE FROM quote_commitments s USING quote_commitments o
 WHERE s.org_id::text = '00000000-0000-0000-0000-000000000002'
   AND s.sales_type = 'support' AND o.sales_type = 'office'
   AND s.org_id = o.org_id AND s.user_name = o.user_name AND s.quote_date = o.quote_date;

UPDATE deals SET sales_type = 'office'
 WHERE org_id::text = '00000000-0000-0000-0000-000000000002' AND sales_type = 'support';
UPDATE quote_commitments SET sales_type = 'office'
 WHERE org_id::text = '00000000-0000-0000-0000-000000000002' AND sales_type = 'support';
