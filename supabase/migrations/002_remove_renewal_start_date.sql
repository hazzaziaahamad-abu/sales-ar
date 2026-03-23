-- Remove start_date column from renewals table
ALTER TABLE renewals DROP COLUMN IF EXISTS start_date;
