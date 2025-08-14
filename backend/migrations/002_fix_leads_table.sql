-- Migration: Fix Leads Table
-- Date: 2025-01-09
-- Description: Add missing columns to leads table for Kanban workflow

-- First, check and update lead status values to new enum
UPDATE leads SET status = 'new' WHERE status NOT IN ('new', 'working', 'qualified', 'trial_scheduled', 'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost');

-- Add workflow tracking fields one by one (MySQL doesn't support IF NOT EXISTS for columns)
ALTER TABLE leads ADD COLUMN stage_entered_at TIMESTAMP NULL AFTER status;
ALTER TABLE leads ADD COLUMN contact_attempts INT DEFAULT 0 AFTER stage_entered_at;
ALTER TABLE leads ADD COLUMN last_contact_attempt TIMESTAMP NULL AFTER contact_attempts;
ALTER TABLE leads ADD COLUMN is_archived BOOLEAN DEFAULT FALSE AFTER last_contact_attempt;
ALTER TABLE leads ADD COLUMN archive_reason VARCHAR(100) NULL AFTER is_archived;
ALTER TABLE leads ADD COLUMN converted_to_user_id INT NULL AFTER archive_reason;
ALTER TABLE leads ADD COLUMN conversion_date TIMESTAMP NULL AFTER converted_to_user_id;
ALTER TABLE leads ADD COLUMN trial_appointment_id INT NULL AFTER conversion_date;
ALTER TABLE leads ADD COLUMN initial_package_size INT NULL AFTER trial_appointment_id;

-- Add indexes
ALTER TABLE leads ADD INDEX idx_leads_archived (is_archived, status);
ALTER TABLE leads ADD INDEX idx_leads_stage (status, stage_entered_at);

-- Set archive flags for terminal states
UPDATE leads 
SET is_archived = TRUE,
    archive_reason = status
WHERE status IN ('converted', 'not_interested', 'lost', 'unreachable', 'wrong_number');

-- Initialize stage_entered_at
UPDATE leads 
SET stage_entered_at = updated_at 
WHERE stage_entered_at IS NULL;