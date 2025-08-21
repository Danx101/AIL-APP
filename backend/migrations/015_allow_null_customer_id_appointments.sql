-- Migration to allow NULL customer_id for lead appointments
-- This fixes the error: "Column 'customer_id' cannot be null"

-- Allow customer_id to be NULL for lead appointments
ALTER TABLE appointments MODIFY COLUMN customer_id INT NULL;

-- Add comment to clarify the purpose
ALTER TABLE appointments MODIFY COLUMN customer_id INT NULL 
COMMENT 'References users.id for customer appointments, NULL for lead appointments';

-- Verification
SELECT 'Migration 015 completed - customer_id can now be NULL for lead appointments' as status;