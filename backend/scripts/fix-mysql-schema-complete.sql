-- Complete MySQL Schema Fix for Railway Database
-- Adds all missing columns to match SQLite schema

-- Fix leads table - add phone_number column (SQLite uses this, MySQL has phone)
ALTER TABLE leads ADD COLUMN phone_number VARCHAR(20);

-- Update existing data to copy phone to phone_number
UPDATE leads SET phone_number = phone WHERE phone_number IS NULL;

-- Fix studios table - add missing columns
ALTER TABLE studios ADD COLUMN cancellation_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN postponement_advance_hours INT DEFAULT 48;
ALTER TABLE studios ADD COLUMN max_advance_booking_days INT DEFAULT 30;
ALTER TABLE studios ADD COLUMN settings_updated_at TIMESTAMP;

-- Fix manager_codes table - add missing columns  
ALTER TABLE manager_codes ADD COLUMN created_by_manager_id INT;
ALTER TABLE manager_codes ADD COLUMN intended_owner_name VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN intended_city VARCHAR(255);
ALTER TABLE manager_codes ADD COLUMN intended_studio_name VARCHAR(255);

-- Fix google_sheets_integrations table - add missing columns
ALTER TABLE google_sheets_integrations ADD COLUMN last_sync_at TIMESTAMP;
ALTER TABLE google_sheets_integrations ADD COLUMN sync_status VARCHAR(50);
ALTER TABLE google_sheets_integrations ADD COLUMN column_mapping TEXT;
ALTER TABLE google_sheets_integrations ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE google_sheets_integrations ADD COLUMN sync_frequency_minutes INT DEFAULT 30;

-- Fix appointments table - ensure it matches SQLite structure
-- Check if columns exist and add them if missing
ALTER TABLE appointments ADD COLUMN appointment_type_id INT;
ALTER TABLE appointments ADD COLUMN start_time TIME;
ALTER TABLE appointments ADD COLUMN end_time TIME;
ALTER TABLE appointments ADD COLUMN notes TEXT;

-- Update column types to match SQLite expectations
ALTER TABLE appointments MODIFY COLUMN status VARCHAR(50);

-- Add any missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_studio_id ON leads(studio_id);
CREATE INDEX IF NOT EXISTS idx_appointments_studio_id ON appointments(studio_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_studios_owner_id ON studios(owner_id);

-- Verify the changes
SHOW COLUMNS FROM leads;
SHOW COLUMNS FROM studios;  
SHOW COLUMNS FROM manager_codes;
SHOW COLUMNS FROM google_sheets_integrations;
SHOW COLUMNS FROM appointments;