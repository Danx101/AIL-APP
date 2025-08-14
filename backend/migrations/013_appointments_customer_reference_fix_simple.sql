-- Migration 013: Fix appointments customer reference and add session tracking (Simplified)
-- This migration fixes the critical issue where appointments.customer_id references users table
-- instead of customers table, and adds proper session tracking

-- Add new columns (ignore errors if they already exist)
ALTER TABLE appointments ADD COLUMN customer_ref_id INT AFTER customer_id;
ALTER TABLE appointments ADD COLUMN session_block_id INT AFTER person_type;  
ALTER TABLE appointments ADD COLUMN sessions_consumed_count INT DEFAULT 1 AFTER session_consumed;

-- Create indexes for performance
CREATE INDEX idx_appointment_customer_ref ON appointments(customer_ref_id);
CREATE INDEX idx_appointment_session_block ON appointments(session_block_id);
CREATE INDEX idx_appointment_timeslot ON appointments(studio_id, appointment_date, start_time, end_time, status);
CREATE INDEX idx_appointment_studio_date ON appointments(studio_id, appointment_date);

-- Migration completed
SELECT 'Migration 013 completed - New columns and indexes added' as status;