ALTER TABLE client_bios ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE client_bios ADD COLUMN IF NOT EXISTS secondary_phone text;
