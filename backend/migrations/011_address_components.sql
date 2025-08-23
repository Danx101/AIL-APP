-- Migration to add detailed address components to users table
-- This provides better structured address data for international users

ALTER TABLE users
ADD COLUMN country VARCHAR(100) DEFAULT 'Österreich' AFTER address;

ALTER TABLE users
ADD COLUMN postal_code VARCHAR(20) AFTER country;

ALTER TABLE users
ADD COLUMN street VARCHAR(200) AFTER postal_code;

ALTER TABLE users
ADD COLUMN house_number VARCHAR(50) AFTER street;

ALTER TABLE users
ADD COLUMN door_apartment VARCHAR(50) AFTER house_number;

-- Create index for address lookups
CREATE INDEX idx_users_location ON users(country, postal_code, city);

-- Add comments for clarity
ALTER TABLE users MODIFY COLUMN address VARCHAR(200) COMMENT 'Legacy combined address field - kept for backward compatibility';
ALTER TABLE users MODIFY COLUMN country VARCHAR(100) COMMENT 'Country (e.g., Österreich, Deutschland)';
ALTER TABLE users MODIFY COLUMN postal_code VARCHAR(20) COMMENT 'Postal/ZIP code';
ALTER TABLE users MODIFY COLUMN street VARCHAR(200) COMMENT 'Street name';
ALTER TABLE users MODIFY COLUMN house_number VARCHAR(50) COMMENT 'House number and staircase (e.g., 12/A)';
ALTER TABLE users MODIFY COLUMN door_apartment VARCHAR(50) COMMENT 'Door/apartment number';

-- Update existing users with default country
UPDATE users 
SET country = 'Österreich' 
WHERE country IS NULL;

-- Note: Existing address data should be manually parsed into components if needed
-- For now, we keep the legacy address field for backward compatibility