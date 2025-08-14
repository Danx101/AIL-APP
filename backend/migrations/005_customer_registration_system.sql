-- Migration 005: Customer Registration System Updates
-- Modify customers table for mandatory session-based model
-- Core rule: Customer = Has Purchased Sessions

-- Add registration code column (unique per customer)
ALTER TABLE customers 
ADD COLUMN registration_code VARCHAR(50) UNIQUE AFTER user_id;

-- Add has_app_access flag
ALTER TABLE customers
ADD COLUMN has_app_access BOOLEAN DEFAULT FALSE AFTER registration_code;

-- Add total sessions purchased counter
ALTER TABLE customers
ADD COLUMN total_sessions_purchased INT DEFAULT 0 AFTER has_app_access;

-- Add customer_since timestamp
ALTER TABLE customers
ADD COLUMN customer_since DATETIME DEFAULT CURRENT_TIMESTAMP AFTER total_sessions_purchased;

-- Add lead conversion tracking
ALTER TABLE customers
ADD COLUMN created_from_lead_id INT NULL AFTER customer_since;

-- Add acquisition type
ALTER TABLE customers
ADD COLUMN acquisition_type ENUM('lead_conversion', 'direct_purchase', 'walk_in') 
  DEFAULT 'direct_purchase' AFTER created_from_lead_id;

-- Add indexes for performance
ALTER TABLE customers
ADD INDEX idx_registration_code (registration_code);

-- Add foreign key for lead conversion tracking
ALTER TABLE customers
ADD CONSTRAINT fk_customer_lead 
FOREIGN KEY (created_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Generate registration codes for any existing customers
-- Format: {studio_identifier}-{customer_id}
UPDATE customers c
INNER JOIN studios s ON c.studio_id = s.id
SET c.registration_code = CONCAT(s.unique_identifier, '-', c.id)
WHERE c.registration_code IS NULL;

-- Update total sessions purchased for existing customers
UPDATE customers c
SET total_sessions_purchased = (
    SELECT COALESCE(SUM(total_sessions), 0)
    FROM customer_sessions cs 
    WHERE cs.customer_id = c.id
)
WHERE total_sessions_purchased = 0;

-- Update has_app_access for customers with user accounts
UPDATE customers 
SET has_app_access = TRUE
WHERE user_id IS NOT NULL;

-- Verify the migration
SELECT 
    c.id,
    c.contact_first_name,
    c.contact_last_name,
    c.registration_code,
    c.has_app_access,
    c.total_sessions_purchased,
    c.customer_since,
    c.acquisition_type,
    s.name as studio_name
FROM customers c
JOIN studios s ON c.studio_id = s.id
ORDER BY c.id;