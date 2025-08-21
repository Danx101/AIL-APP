-- Migration: Add expected_weekly_appointments column to studios table
-- This allows studio owners to set their expected number of appointments per week
-- for more accurate utilization calculations

ALTER TABLE studios 
ADD COLUMN expected_weekly_appointments INT DEFAULT 40;

-- Set a reasonable default based on existing machine count where possible
UPDATE studios 
SET expected_weekly_appointments = COALESCE(machine_count * 8 * 5, 40)
WHERE expected_weekly_appointments IS NULL OR expected_weekly_appointments = 40;