-- Per-client recommendation for subscribers imported into قائمة الاستهداف
-- (basic-plan renewals + closed support sales) to pitch loyalty cards / cashier.
ALTER TABLE targeting_clients
  ADD COLUMN IF NOT EXISTS recommendation TEXT;

ALTER TABLE targeting_clients
  ADD COLUMN IF NOT EXISTS recommendation_priority TEXT;
