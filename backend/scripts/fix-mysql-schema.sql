-- Fix MySQL Schema for Railway Database (MySQL 5.7 compatible)
-- Run this in Railway MySQL console before migration

-- Fix Studios table (check if columns exist first)
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'cancellation_advance_hours' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE studios ADD COLUMN cancellation_advance_hours INT DEFAULT 48'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'postponement_advance_hours' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE studios ADD COLUMN postponement_advance_hours INT DEFAULT 48'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'max_advance_booking_days' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE studios ADD COLUMN max_advance_booking_days INT DEFAULT 30'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'studios' AND column_name = 'settings_updated_at' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE studios ADD COLUMN settings_updated_at TIMESTAMP'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix Manager codes table
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'manager_codes' AND column_name = 'intended_owner_name' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE manager_codes ADD COLUMN intended_owner_name VARCHAR(255)'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'manager_codes' AND column_name = 'intended_city' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE manager_codes ADD COLUMN intended_city VARCHAR(255)'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'manager_codes' AND column_name = 'intended_studio_name' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE manager_codes ADD COLUMN intended_studio_name VARCHAR(255)'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix Google sheets integrations table
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'google_sheets_integrations' AND column_name = 'last_sync_at' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE google_sheets_integrations ADD COLUMN last_sync_at TIMESTAMP'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'google_sheets_integrations' AND column_name = 'sync_status' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE google_sheets_integrations ADD COLUMN sync_status VARCHAR(50)'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'google_sheets_integrations' AND column_name = 'column_mapping' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE google_sheets_integrations ADD COLUMN column_mapping TEXT'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'google_sheets_integrations' AND column_name = 'auto_sync_enabled' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE google_sheets_integrations ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'google_sheets_integrations' AND column_name = 'sync_frequency_minutes' AND table_schema = DATABASE()) > 0,
  'SELECT "Column exists"',
  'ALTER TABLE google_sheets_integrations ADD COLUMN sync_frequency_minutes INT DEFAULT 30'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add session_blocks table if missing
CREATE TABLE IF NOT EXISTS session_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  studio_id INT NOT NULL,
  package_type VARCHAR(50) NOT NULL,
  total_sessions INT NOT NULL,
  used_sessions INT DEFAULT 0,
  remaining_sessions INT NOT NULL,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Verify all tables exist
SHOW TABLES;

-- Check if columns were added successfully
DESCRIBE studios;
DESCRIBE manager_codes;
DESCRIBE google_sheets_integrations;