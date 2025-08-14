-- Migration 009: Email Verification System
-- Adds email verification fields for studio and customer registration

-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE AFTER role;

ALTER TABLE users
ADD COLUMN email_verification_token VARCHAR(255) UNIQUE AFTER email_verified;

ALTER TABLE users
ADD COLUMN email_verification_expires TIMESTAMP NULL AFTER email_verification_token;

-- Add index for faster token lookups
ALTER TABLE users
ADD INDEX idx_email_verification (email_verification_token);

-- Mark all existing users as verified (they're already active)
UPDATE users 
SET email_verified = TRUE 
WHERE email_verified IS NULL OR email_verified = FALSE;

-- Add studio activation status (for email verification flow)
ALTER TABLE studios
ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER unique_identifier;

-- Update all existing studios to active
UPDATE studios 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Verify the migration
SELECT 
    'Email verification fields added' as status,
    COUNT(*) as verified_users
FROM users 
WHERE email_verified = TRUE;