ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text DEFAULT 'scan';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status text DEFAULT 'captured';
