-- AI email sequences stored per contact (generated in app, optional save)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sequences jsonb DEFAULT NULL;
