-- Migration to add verification_attempts column to users table
-- This tracks how many times a user has requested a verification email

ALTER TABLE users
ADD COLUMN verification_attempts INT DEFAULT 0 AFTER email_verification_expires;

-- Update existing unverified users to have 1 attempt
UPDATE users 
SET verification_attempts = 1 
WHERE email_verified = FALSE AND email_verification_token IS NOT NULL;