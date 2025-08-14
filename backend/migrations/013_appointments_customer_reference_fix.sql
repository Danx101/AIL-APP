-- Migration 013: Fix appointments customer reference and add session tracking
-- This migration fixes the critical issue where appointments.customer_id references users table
-- instead of customers table, and adds proper session tracking

-- Step 1: Add new columns for proper customer reference and session tracking
-- Check if columns already exist before adding them
SET @col1_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'appointments' 
                    AND COLUMN_NAME = 'customer_ref_id');

SET @col2_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'appointments' 
                    AND COLUMN_NAME = 'session_block_id');

SET @col3_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'appointments' 
                    AND COLUMN_NAME = 'sessions_consumed_count');

-- Add customer_ref_id column if it doesn't exist
SET @sql_col1 = IF(@col1_exists > 0, 
  'SELECT "Column customer_ref_id already exists" as status',
  'ALTER TABLE appointments ADD COLUMN customer_ref_id INT AFTER customer_id'
);
PREPARE stmt_col1 FROM @sql_col1;
EXECUTE stmt_col1;
DEALLOCATE PREPARE stmt_col1;

-- Add session_block_id column if it doesn't exist
SET @sql_col2 = IF(@col2_exists > 0,
  'SELECT "Column session_block_id already exists" as status', 
  'ALTER TABLE appointments ADD COLUMN session_block_id INT AFTER person_type'
);
PREPARE stmt_col2 FROM @sql_col2;
EXECUTE stmt_col2;
DEALLOCATE PREPARE stmt_col2;

-- Add sessions_consumed_count column if it doesn't exist
SET @sql_col3 = IF(@col3_exists > 0,
  'SELECT "Column sessions_consumed_count already exists" as status', 
  'ALTER TABLE appointments ADD COLUMN sessions_consumed_count INT DEFAULT 1 AFTER session_consumed'
);
PREPARE stmt_col3 FROM @sql_col3;
EXECUTE stmt_col3;
DEALLOCATE PREPARE stmt_col3;

-- Step 2: Add foreign key constraints (after columns are created)
-- Check if foreign keys already exist before creating
SET @fk1_exists = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'appointments' 
                   AND CONSTRAINT_NAME = 'fk_appointment_customer_ref');

SET @fk2_exists = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'appointments' 
                   AND CONSTRAINT_NAME = 'fk_appointment_session_block');

-- Add customer reference foreign key if it doesn't exist
SET @sql1 = IF(@fk1_exists > 0, 
  'SELECT "Foreign key fk_appointment_customer_ref already exists" as status',
  'ALTER TABLE appointments ADD CONSTRAINT fk_appointment_customer_ref FOREIGN KEY (customer_ref_id) REFERENCES customers(id) ON DELETE CASCADE'
);
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- Add session block foreign key if it doesn't exist  
SET @sql2 = IF(@fk2_exists > 0,
  'SELECT "Foreign key fk_appointment_session_block already exists" as status', 
  'ALTER TABLE appointments ADD CONSTRAINT fk_appointment_session_block FOREIGN KEY (session_block_id) REFERENCES customer_sessions(id) ON DELETE SET NULL'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Step 3: Migrate existing customer appointments to use customers table
-- This attempts to match users to customers by email and studio_id
UPDATE appointments a
JOIN users u ON a.customer_id = u.id
JOIN customers c ON c.contact_email = u.email AND c.studio_id = a.studio_id
SET a.customer_ref_id = c.id
WHERE a.person_type = 'customer' AND a.customer_id IS NOT NULL;

-- Step 4: For appointments that couldn't be matched, log them for manual review
-- (These will show customer_ref_id as NULL and need manual fixing)
SELECT 
    a.id as appointment_id,
    a.studio_id,
    u.email as user_email,
    u.first_name,
    u.last_name,
    'NEEDS_MANUAL_MAPPING' as status
FROM appointments a
JOIN users u ON a.customer_id = u.id
WHERE a.person_type = 'customer' 
  AND a.customer_id IS NOT NULL 
  AND a.customer_ref_id IS NULL
ORDER BY a.studio_id, a.appointment_date;

-- Step 5: Add performance indexes
CREATE INDEX idx_appointment_customer_ref ON appointments(customer_ref_id);
CREATE INDEX idx_appointment_session_block ON appointments(session_block_id);
CREATE INDEX idx_appointment_timeslot ON appointments(studio_id, appointment_date, start_time, end_time, status);
CREATE INDEX idx_appointment_studio_date ON appointments(studio_id, appointment_date);

-- Step 6: Update appointments to link with active session blocks where possible
-- This links existing completed appointments to their session blocks for tracking
UPDATE appointments a
JOIN customers c ON a.customer_ref_id = c.id
JOIN customer_sessions cs ON cs.customer_id = c.id 
SET a.session_block_id = cs.id
WHERE a.person_type = 'customer' 
  AND a.customer_ref_id IS NOT NULL
  AND a.session_block_id IS NULL
  AND cs.status IN ('active', 'completed')
  AND EXISTS (
    SELECT 1 FROM appointment_types at 
    WHERE at.id = a.appointment_type_id 
    AND at.consumes_session = 1
  )
ORDER BY cs.purchase_date DESC
LIMIT 1;

-- Step 7: Verification queries
-- Count successful migrations
SELECT 
    COUNT(*) as total_customer_appointments,
    SUM(CASE WHEN customer_ref_id IS NOT NULL THEN 1 ELSE 0 END) as successfully_migrated,
    SUM(CASE WHEN customer_ref_id IS NULL THEN 1 ELSE 0 END) as needs_manual_fix
FROM appointments 
WHERE person_type = 'customer';

-- Show appointments that need manual attention
SELECT 
    a.id,
    a.studio_id,
    a.appointment_date,
    u.email,
    u.first_name,
    u.last_name,
    'Customer not found in customers table' as issue
FROM appointments a
LEFT JOIN users u ON a.customer_id = u.id
WHERE a.person_type = 'customer' 
  AND a.customer_id IS NOT NULL 
  AND a.customer_ref_id IS NULL;

-- Step 8: Add helpful comments
COMMENT ON COLUMN appointments.customer_ref_id IS 'References customers.id (studio customers), replaces customer_id which referenced users.id';
COMMENT ON COLUMN appointments.session_block_id IS 'Links to customer_sessions.id to track which session block was used for this appointment';
COMMENT ON COLUMN appointments.sessions_consumed_count IS 'Number of sessions consumed by this appointment (usually 1, but configurable)';

-- Migration completed successfully
SELECT 'Migration 013 completed - Appointments customer reference and session tracking fixed' as status;