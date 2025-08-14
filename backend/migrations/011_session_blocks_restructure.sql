-- Migration 011: Restructure session management to use simplified block system
-- This migration transforms the session tracking from dual-storage to single-source blocks

-- Step 1-3: Add new columns (will skip if they already exist)
-- Using stored procedure to handle column existence check
DELIMITER $$

DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDefinition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = tableName
        AND COLUMN_NAME = columnName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- Add columns if they don't exist
CALL AddColumnIfNotExists('customer_sessions', 'payment_method', 'VARCHAR(20) DEFAULT \'cash\'');
CALL AddColumnIfNotExists('customer_sessions', 'payment_amount', 'DECIMAL(10,2)');
CALL AddColumnIfNotExists('customer_sessions', 'status', 'ENUM(\'active\', \'pending\', \'completed\') DEFAULT \'active\'');

-- Step 4: Update existing records to set proper status
-- Set completed status for blocks with 0 remaining sessions
UPDATE customer_sessions 
SET status = 'completed' 
WHERE remaining_sessions = 0;

-- Set active status for blocks with remaining sessions and is_active = 1
UPDATE customer_sessions 
SET status = 'active' 
WHERE remaining_sessions > 0 AND is_active = 1;

-- Set pending status for blocks with remaining sessions but is_active = 0
UPDATE customer_sessions 
SET status = 'pending' 
WHERE remaining_sessions > 0 AND (is_active = 0 OR is_active IS NULL);

-- Step 5: Add activation_date column to track when block became active
CALL AddColumnIfNotExists('customer_sessions', 'activation_date', 'DATETIME');

-- Set activation_date for currently active blocks (use purchase_date as approximation)
UPDATE customer_sessions 
SET activation_date = purchase_date 
WHERE status = 'active';

-- Step 6: Add block_type column to explicitly track package size
CALL AddColumnIfNotExists('customer_sessions', 'block_type', 'INT');

-- Set block_type based on total_sessions
UPDATE customer_sessions 
SET block_type = total_sessions;

-- Step 7: Clean up data - ensure only one active and one pending per customer
-- First, identify customers with multiple active blocks
CREATE TEMPORARY TABLE duplicate_active_blocks AS
SELECT customer_id, COUNT(*) as active_count
FROM customer_sessions
WHERE status = 'active'
GROUP BY customer_id
HAVING COUNT(*) > 1;

-- For customers with multiple active blocks, keep only the oldest one active
UPDATE customer_sessions cs
INNER JOIN duplicate_active_blocks dab ON cs.customer_id = dab.customer_id
SET cs.status = 'pending', cs.activation_date = NULL
WHERE cs.status = 'active'
  AND cs.id NOT IN (
    SELECT id FROM (
      SELECT MIN(id) as id
      FROM customer_sessions
      WHERE status = 'active'
      GROUP BY customer_id
    ) as keep_active
  );

DROP TEMPORARY TABLE duplicate_active_blocks;

-- Step 8: Handle customers with multiple pending blocks (keep newest, complete others)
CREATE TEMPORARY TABLE duplicate_pending_blocks AS
SELECT customer_id, COUNT(*) as pending_count
FROM customer_sessions
WHERE status = 'pending'
GROUP BY customer_id
HAVING COUNT(*) > 1;

-- Keep only the newest pending block, mark others as completed
UPDATE customer_sessions cs
INNER JOIN duplicate_pending_blocks dpb ON cs.customer_id = dpb.customer_id
SET cs.status = 'completed'
WHERE cs.status = 'pending'
  AND cs.id NOT IN (
    SELECT id FROM (
      SELECT MAX(id) as id
      FROM customer_sessions
      WHERE status = 'pending'
      GROUP BY customer_id
    ) as keep_pending
  );

DROP TEMPORARY TABLE duplicate_pending_blocks;

-- Step 9: Create unique constraints to enforce business rules
-- Note: MySQL doesn't support partial unique indexes directly, so we'll handle this in application logic
-- But we can create a regular unique index as a safety measure
ALTER TABLE customer_sessions
ADD INDEX idx_customer_status (customer_id, status);

-- Step 10-11: Clean up columns
-- Check and drop queue_position if exists
DELIMITER $$
DROP PROCEDURE IF EXISTS DropColumnIfExists$$
CREATE PROCEDURE DropColumnIfExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64)
)
BEGIN
    IF EXISTS (
        SELECT * FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = tableName
        AND COLUMN_NAME = columnName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' DROP COLUMN ', columnName);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL DropColumnIfExists('customer_sessions', 'queue_position');
CALL DropColumnIfExists('customer_sessions', 'is_active');

-- Clean up procedures
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS DropColumnIfExists;

-- Verify the migration
SELECT 
  'Migration 011 completed successfully' as status,
  COUNT(DISTINCT customer_id) as total_customers_with_sessions,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_blocks,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_blocks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_blocks
FROM customer_sessions;