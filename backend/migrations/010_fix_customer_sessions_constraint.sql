-- Fix foreign key constraint in customer_sessions table
-- The customer_id should reference customers.id, not users.id

-- First, drop the existing incorrect foreign key constraint
ALTER TABLE customer_sessions DROP FOREIGN KEY customer_sessions_ibfk_1;

-- Add the correct foreign key constraint
ALTER TABLE customer_sessions 
ADD CONSTRAINT customer_sessions_customer_fk 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Note: Keeping studio_id constraint as it's already correct