-- Add profile_email column for Gmail integrations
ALTER TABLE integration_connections
    ADD COLUMN IF NOT EXISTS profile_email TEXT;

-- Rollback
-- ALTER TABLE integration_connections
--     DROP COLUMN IF EXISTS profile_email;
