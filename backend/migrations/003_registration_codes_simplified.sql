-- Migration: Simplified Registration Code System
-- Date: 2025-01-10
-- Description: Implement registration codes stored in database, customers must have sessions

-- ============================================
-- PHASE 1: Update Studio Unique Identifiers
-- ============================================

-- Update studio identifiers to use city-based codes
UPDATE studios 
SET unique_identifier = CASE 
    WHEN city LIKE '%Berlin%' THEN CONCAT('BER-', id)
    WHEN city LIKE '%Munich%' OR city LIKE '%München%' THEN CONCAT('MUC-', id)
    WHEN city LIKE '%Hamburg%' THEN CONCAT('HAM-', id)
    WHEN city LIKE '%Frankfurt%' THEN CONCAT('FRA-', id)
    WHEN city LIKE '%Cologne%' OR city LIKE '%Köln%' THEN CONCAT('CGN-', id)
    WHEN city LIKE '%Stuttgart%' THEN CONCAT('STR-', id)
    WHEN city LIKE '%Düsseldorf%' THEN CONCAT('DUS-', id)
    ELSE CONCAT('STU-', id)
END
WHERE unique_identifier IS NOT NULL;

-- Remove registration_enabled column as all studios can register customers
ALTER TABLE studios DROP COLUMN IF EXISTS registration_enabled;

-- ============================================
-- PHASE 2: Update Customers Table for Registration Codes
-- ============================================

-- Add registration code and related columns
ALTER TABLE customers 
ADD COLUMN registration_code VARCHAR(50) UNIQUE AFTER user_id,
ADD COLUMN has_app_access BOOLEAN DEFAULT FALSE AFTER registration_code,
ADD COLUMN total_sessions_purchased INT DEFAULT 0 AFTER has_app_access,
ADD COLUMN customer_since DATETIME DEFAULT CURRENT_TIMESTAMP AFTER total_sessions_purchased;

-- Add index for registration code lookups
ALTER TABLE customers ADD INDEX idx_registration_code (registration_code);

-- Generate registration codes for ALL existing customers
UPDATE customers c
SET registration_code = CONCAT(
    (SELECT unique_identifier FROM studios WHERE id = c.studio_id),
    '-',
    c.id
)
WHERE registration_code IS NULL;

-- Calculate total sessions purchased for existing customers
UPDATE customers c
SET total_sessions_purchased = (
    SELECT COALESCE(SUM(total_sessions), 0)
    FROM customer_sessions cs 
    WHERE cs.customer_id = c.id
)
WHERE total_sessions_purchased = 0;

-- Mark customers with user accounts as having app access
UPDATE customers 
SET has_app_access = TRUE 
WHERE user_id IS NOT NULL;

-- Set customer_since based on earliest session purchase or creation date
UPDATE customers c
SET customer_since = COALESCE(
    (SELECT MIN(created_at) FROM customer_sessions WHERE customer_id = c.id),
    c.created_at
)
WHERE customer_since IS NULL;

-- ============================================
-- PHASE 3: Simplify Appointment Person Types
-- ============================================

-- First update existing appointments to simplified types
UPDATE appointments 
SET person_type = CASE
    WHEN lead_id IS NOT NULL THEN 'lead'
    WHEN customer_id IS NOT NULL THEN 'customer'
    ELSE person_type
END
WHERE person_type IN ('registered_customer', 'offline_customer');

-- Modify the enum to simplified version
ALTER TABLE appointments 
MODIFY COLUMN person_type ENUM('customer', 'lead') DEFAULT 'customer';

-- Remove the offline_customer_id column as all customers use customer_id
ALTER TABLE appointments DROP COLUMN IF EXISTS offline_customer_id;

-- ============================================
-- PHASE 4: Update Leads Table for Conversion Tracking
-- ============================================

-- Add column to track which customer a lead converted to
ALTER TABLE leads 
ADD COLUMN converted_to_customer_id INT NULL AFTER converted_to_user_id,
ADD INDEX idx_lead_customer_conversion (converted_to_customer_id),
ADD FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ============================================
-- PHASE 5: Clean Up Customer Table
-- ============================================

-- Remove customer_type column as we no longer differentiate
ALTER TABLE customers DROP COLUMN IF EXISTS customer_type;

-- Remove offline_identifier as registration_code serves this purpose
ALTER TABLE customers DROP COLUMN IF EXISTS offline_identifier;

-- ============================================
-- PHASE 6: Data Validation Queries
-- ============================================

-- Check for customers without registration codes (should be 0)
SELECT COUNT(*) as customers_without_codes 
FROM customers 
WHERE registration_code IS NULL;

-- Check for customers without sessions (these need review)
SELECT c.id, c.contact_first_name, c.contact_last_name, 
       c.registration_code, c.total_sessions_purchased
FROM customers c
WHERE c.total_sessions_purchased = 0;

-- Verify registration code uniqueness
SELECT registration_code, COUNT(*) as count 
FROM customers 
GROUP BY registration_code 
HAVING count > 1;

-- Check appointment person types
SELECT person_type, COUNT(*) as count 
FROM appointments 
GROUP BY person_type;

-- ============================================
-- PHASE 7: Create Helper Views
-- ============================================

-- Create view for customer registration status
CREATE OR REPLACE VIEW customer_registration_status AS
SELECT 
    c.id,
    c.studio_id,
    c.registration_code,
    c.contact_first_name,
    c.contact_last_name,
    c.contact_phone,
    c.contact_email,
    c.has_app_access,
    c.total_sessions_purchased,
    COALESCE(
        (SELECT SUM(remaining_sessions) 
         FROM customer_sessions cs 
         WHERE cs.customer_id = c.id AND cs.is_active = 1), 
        0
    ) as remaining_sessions,
    c.customer_since,
    CASE 
        WHEN c.has_app_access THEN 'App User'
        WHEN c.total_sessions_purchased > 0 THEN 'Can Register'
        ELSE 'Needs Sessions'
    END as registration_status
FROM customers c;

-- Create view for lead pipeline
CREATE OR REPLACE VIEW lead_pipeline AS
SELECT 
    l.id,
    l.studio_id,
    l.name,
    l.phone_number,
    l.email,
    l.status,
    l.is_archived,
    l.contact_attempts,
    l.stage_entered_at,
    l.converted_to_customer_id,
    c.registration_code as customer_code,
    CASE 
        WHEN l.is_archived THEN 'archived'
        ELSE 'active'
    END as pipeline_state
FROM leads l
LEFT JOIN customers c ON l.converted_to_customer_id = c.id;

-- ============================================
-- VERIFICATION OUTPUT
-- ============================================

-- Display summary
SELECT 'Migration Complete!' as Status,
       (SELECT COUNT(*) FROM customers WHERE registration_code IS NOT NULL) as customers_with_codes,
       (SELECT COUNT(*) FROM customers WHERE has_app_access = TRUE) as app_users,
       (SELECT COUNT(*) FROM leads WHERE is_archived = FALSE) as active_leads;