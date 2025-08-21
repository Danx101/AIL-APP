-- Migration: User Profile and Legal Compliance Fields
-- Date: 2025-01-20
-- Description: Add city, address, and legal compliance fields to users table

-- Add profile fields to users table
ALTER TABLE users 
ADD COLUMN city VARCHAR(100) AFTER phone,
ADD COLUMN address VARCHAR(200) AFTER city,
ADD COLUMN terms_accepted BOOLEAN DEFAULT FALSE AFTER address,
ADD COLUMN terms_accepted_at DATETIME NULL AFTER terms_accepted,
ADD COLUMN privacy_accepted BOOLEAN DEFAULT FALSE AFTER terms_accepted_at,
ADD COLUMN privacy_accepted_at DATETIME NULL AFTER privacy_accepted;

-- Create index for compliance tracking
CREATE INDEX idx_users_compliance ON users(terms_accepted, privacy_accepted);

-- Note: City and address in users table represent personal/billing address
-- Business location address remains in studios table