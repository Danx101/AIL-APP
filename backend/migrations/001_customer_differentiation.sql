-- Migration: Customer Differentiation & Studio Unique Identifiers
-- Date: 2025-01-09
-- Description: Implement support for registered vs offline customers and replace activation codes with studio IDs

-- ============================================
-- PHASE 1: Add Studio Unique Identifiers
-- ============================================

-- Add unique identifier to studios (replacing activation codes)
ALTER TABLE studios 
ADD COLUMN unique_identifier VARCHAR(20) UNIQUE AFTER name,
ADD COLUMN registration_enabled BOOLEAN DEFAULT TRUE AFTER unique_identifier,
ADD INDEX idx_studio_identifier (unique_identifier);

-- Generate unique identifiers for existing studios
UPDATE studios SET unique_identifier = CONCAT('STU-', UPPER(LEFT(city, 3)), '-', id)
WHERE unique_identifier IS NULL;

-- ============================================
-- PHASE 2: Modify Customers Table for Offline Support
-- ============================================

-- First, check if customers table exists, if not create it
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  studio_id INT NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_first_name VARCHAR(100),
  contact_last_name VARCHAR(100),
  probebehandlung_used BOOLEAN DEFAULT FALSE,
  probebehandlung_appointment_id INT,
  last_weight DECIMAL(5,2),
  goal_weight DECIMAL(5,2),
  initial_weight DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_studio (user_id, studio_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  INDEX idx_studio_customers (studio_id)
);

-- Modify customers table to support offline customers
ALTER TABLE customers 
MODIFY COLUMN user_id INT NULL;

-- Add new columns for customer differentiation
ALTER TABLE customers 
ADD COLUMN customer_type ENUM('registered', 'offline') DEFAULT 'registered' AFTER user_id,
ADD COLUMN offline_identifier VARCHAR(100) AFTER customer_type,
ADD COLUMN created_from_lead_id INT NULL AFTER offline_identifier,
ADD COLUMN acquisition_type ENUM('lead_conversion', 'direct_purchase', 'online_registration', 'manual_entry') 
  DEFAULT 'online_registration' AFTER created_from_lead_id,
ADD INDEX idx_customer_type (customer_type, studio_id),
ADD INDEX idx_offline_identifier (offline_identifier);

-- Update existing customers to 'registered' type
UPDATE customers 
SET customer_type = 'registered',
    acquisition_type = 'online_registration'
WHERE user_id IS NOT NULL;

-- ============================================
-- PHASE 3: Update Appointments Table
-- ============================================

-- Add support for leads and offline customers
ALTER TABLE appointments 
ADD COLUMN lead_id INT NULL AFTER customer_id,
ADD COLUMN offline_customer_id INT NULL AFTER lead_id,
ADD COLUMN person_type ENUM('registered_customer', 'offline_customer', 'lead') DEFAULT 'registered_customer' AFTER offline_customer_id,
ADD INDEX idx_appointment_lead (lead_id),
ADD INDEX idx_appointment_offline (offline_customer_id),
ADD INDEX idx_appointment_person_type (person_type, appointment_date);

-- Update existing appointments based on customer type
UPDATE appointments a
LEFT JOIN customers c ON a.customer_id = c.id
SET a.person_type = CASE 
  WHEN c.customer_type = 'registered' THEN 'registered_customer'
  WHEN c.customer_type = 'offline' THEN 'offline_customer'
  ELSE 'registered_customer'
END
WHERE a.customer_id IS NOT NULL;

-- ============================================
-- PHASE 4: Update Leads Table
-- ============================================

-- Check if leads table exists and has required columns
ALTER TABLE leads 
MODIFY COLUMN status ENUM('new', 'working', 'qualified', 'trial_scheduled', 
     'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost') 
DEFAULT 'new';

-- Add workflow tracking fields if they don't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMP NULL AFTER status,
ADD COLUMN IF NOT EXISTS contact_attempts INT DEFAULT 0 AFTER stage_entered_at,
ADD COLUMN IF NOT EXISTS last_contact_attempt TIMESTAMP NULL AFTER contact_attempts,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE AFTER last_contact_attempt,
ADD COLUMN IF NOT EXISTS archive_reason VARCHAR(100) NULL AFTER is_archived,
ADD COLUMN IF NOT EXISTS converted_to_user_id INT NULL AFTER archive_reason,
ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP NULL AFTER converted_to_user_id,
ADD COLUMN IF NOT EXISTS trial_appointment_id INT NULL AFTER conversion_date,
ADD COLUMN IF NOT EXISTS initial_package_size INT NULL AFTER trial_appointment_id,
ADD INDEX IF NOT EXISTS idx_leads_archived (is_archived, status),
ADD INDEX IF NOT EXISTS idx_leads_stage (status, stage_entered_at);

-- ============================================
-- PHASE 5: Create Lead Activities Table
-- ============================================

CREATE TABLE IF NOT EXISTS lead_activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lead_id INT NOT NULL,
  studio_id INT NOT NULL,
  activity_type ENUM('status_change', 'call', 'email', 'sms', 'note', 
                     'appointment_scheduled', 'appointment_completed', 
                     'conversion', 'archive') NOT NULL,
  description TEXT,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  metadata JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead_activities (lead_id, created_at),
  INDEX idx_activity_type (activity_type, studio_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- PHASE 6: Data Migration
-- ============================================

-- Map existing lead statuses to new enum values (if needed)
UPDATE leads SET status = CASE
  WHEN status = 'neu' THEN 'new'
  WHEN status = 'kontaktiert' THEN 'working'
  WHEN status = 'konvertiert' THEN 'converted'
  WHEN status = 'nicht_interessiert' THEN 'not_interested'
  ELSE status
END
WHERE status IN ('neu', 'kontaktiert', 'konvertiert', 'nicht_interessiert');

-- Set archive flags for terminal states
UPDATE leads 
SET is_archived = TRUE,
    archive_reason = status
WHERE status IN ('converted', 'not_interested', 'lost', 'unreachable', 'wrong_number')
  AND is_archived = FALSE;

-- Initialize stage_entered_at
UPDATE leads 
SET stage_entered_at = updated_at 
WHERE stage_entered_at IS NULL;

-- ============================================
-- PHASE 7: Create Backup & Cleanup
-- ============================================

-- Create backup of activation codes before removal
CREATE TABLE IF NOT EXISTS activation_codes_backup AS 
SELECT * FROM activation_codes;

-- Note: Uncomment the following line only after verifying the migration
-- DROP TABLE activation_codes;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify studio unique identifiers
SELECT id, name, city, unique_identifier, registration_enabled 
FROM studios;

-- Verify customer types
SELECT customer_type, COUNT(*) as count 
FROM customers 
GROUP BY customer_type;

-- Verify appointment person types
SELECT person_type, COUNT(*) as count 
FROM appointments 
GROUP BY person_type;

-- Verify lead statuses
SELECT status, is_archived, COUNT(*) as count 
FROM leads 
GROUP BY status, is_archived;