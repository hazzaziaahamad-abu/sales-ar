-- Add optional free-text category (تصنيف) field to deals for grouping & filtering
ALTER TABLE deals ADD COLUMN IF NOT EXISTS category text;
