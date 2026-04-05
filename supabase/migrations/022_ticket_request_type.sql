-- Add request_type column to tickets table
-- Values: 'problem' (مشكلة) or 'service' (خدمة)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'problem';
