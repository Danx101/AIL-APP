-- Migration: Cleanup and Fixes
-- Date: 2025-01-10
-- Description: Fix remaining issues from previous migrations

-- Fix appointment person types
ALTER TABLE appointments MODIFY COLUMN person_type VARCHAR(50);
UPDATE appointments SET person_type = 'customer' WHERE person_type = 'registered_customer';
UPDATE appointments SET person_type = 'customer' WHERE person_type = 'offline_customer';
ALTER TABLE appointments MODIFY COLUMN person_type ENUM('customer', 'lead') DEFAULT 'customer';

-- Drop columns that are no longer needed
ALTER TABLE customers DROP COLUMN customer_type;
ALTER TABLE customers DROP COLUMN offline_identifier;
ALTER TABLE appointments DROP COLUMN offline_customer_id;
ALTER TABLE studios DROP COLUMN registration_enabled;

-- Verify final state
SELECT 'Tables cleaned up successfully' as status;