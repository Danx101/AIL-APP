-- Quick fix for missing auslastung settings columns
-- Run this script directly on the Railway MySQL database

-- Add missing columns to studios table
ALTER TABLE studios ADD COLUMN IF NOT EXISTS expected_weekly_appointments INT DEFAULT 40;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMP;

-- Set reasonable defaults for existing studios
UPDATE studios 
SET expected_weekly_appointments = COALESCE(machine_count * 8 * 5, 40)
WHERE expected_weekly_appointments IS NULL OR expected_weekly_appointments = 0;

-- Show columns to verify
DESCRIBE studios;