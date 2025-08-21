-- Migration: Add missing columns to studios table for auslastung settings
-- This fixes the 500 error when saving auslastung settings

-- Add expected_weekly_appointments column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'expected_weekly_appointments' AND table_schema = DATABASE()) = 0,
  'ALTER TABLE studios ADD COLUMN expected_weekly_appointments INT DEFAULT 40',
  'SELECT "expected_weekly_appointments column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add settings_updated_at column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'settings_updated_at' AND table_schema = DATABASE()) = 0,
  'ALTER TABLE studios ADD COLUMN settings_updated_at TIMESTAMP',
  'SELECT "settings_updated_at column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing studios to have a reasonable default for expected_weekly_appointments
-- based on machine_count if they don't already have a value
UPDATE studios 
SET expected_weekly_appointments = COALESCE(machine_count * 8 * 5, 40)
WHERE expected_weekly_appointments IS NULL OR expected_weekly_appointments = 0;