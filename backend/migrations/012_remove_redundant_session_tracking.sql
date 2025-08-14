-- Migration 012: Remove redundant session tracking from customers table
-- This completes the transition to single-source-of-truth session management

-- Step 1: Backup current total_sessions_purchased values for verification
-- Create a temporary backup table
CREATE TEMPORARY TABLE customer_sessions_backup AS
SELECT 
  id as customer_id,
  total_sessions_purchased as old_total_sessions,
  (SELECT COALESCE(SUM(total_sessions), 0) 
   FROM customer_sessions 
   WHERE customer_id = customers.id) as calculated_total_sessions
FROM customers
WHERE total_sessions_purchased > 0;

-- Step 2: Log any discrepancies for review
SELECT 
  customer_id,
  old_total_sessions,
  calculated_total_sessions,
  (old_total_sessions - calculated_total_sessions) as difference
FROM customer_sessions_backup
WHERE old_total_sessions != calculated_total_sessions;

-- Step 3: Remove the redundant column from customers table
ALTER TABLE customers
DROP COLUMN IF EXISTS total_sessions_purchased;

-- Step 4: Create a view for easy access to customer session summary
CREATE OR REPLACE VIEW customer_session_summary AS
SELECT 
  c.id as customer_id,
  c.studio_id,
  c.contact_first_name,
  c.contact_last_name,
  c.registration_code,
  -- Active block info
  active.remaining_sessions as active_sessions,
  active.block_type as active_block_type,
  active.activation_date as active_block_started,
  -- Pending block info  
  pending.remaining_sessions as pending_sessions,
  pending.block_type as pending_block_type,
  -- Lifetime totals
  COALESCE(SUM(cs.total_sessions), 0) as total_purchased_lifetime,
  COALESCE(SUM(CASE WHEN cs.status = 'completed' THEN cs.total_sessions ELSE 0 END), 0) as total_completed_sessions
FROM customers c
LEFT JOIN customer_sessions active ON c.id = active.customer_id AND active.status = 'active'
LEFT JOIN customer_sessions pending ON c.id = pending.customer_id AND pending.status = 'pending'
LEFT JOIN customer_sessions cs ON c.id = cs.customer_id
GROUP BY c.id, active.remaining_sessions, active.block_type, active.activation_date, 
         pending.remaining_sessions, pending.block_type;

-- Step 5: Verify the migration
SELECT 
  'Migration 012 completed successfully' as status,
  COUNT(*) as total_customers,
  SUM(CASE WHEN active_sessions > 0 THEN 1 ELSE 0 END) as customers_with_active_sessions,
  SUM(CASE WHEN pending_sessions > 0 THEN 1 ELSE 0 END) as customers_with_pending_sessions
FROM customer_session_summary;

DROP TEMPORARY TABLE customer_sessions_backup;