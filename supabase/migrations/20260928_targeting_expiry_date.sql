-- تاريخ انتهاء اشتراك العميل في قائمة الاستهداف.
ALTER TABLE targeting_clients ADD COLUMN IF NOT EXISTS expiry_date DATE;
