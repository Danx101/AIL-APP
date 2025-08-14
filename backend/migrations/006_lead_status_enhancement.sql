-- Migration 006: Lead Status Enhancement
-- Update lead status enum for Kanban workflow and add tracking fields

-- First, update the status column to support new workflow states
ALTER TABLE leads MODIFY COLUMN status 
ENUM('new', 'working', 'qualified', 'trial_scheduled', 
     'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost',
     'neu', 'kontaktiert', 'konvertiert') 
DEFAULT 'new';

-- Add workflow tracking fields
ALTER TABLE leads 
ADD COLUMN stage_entered_at TIMESTAMP NULL AFTER status;

ALTER TABLE leads
ADD COLUMN contact_attempts INT DEFAULT 0 AFTER stage_entered_at;

ALTER TABLE leads
ADD COLUMN last_contact_attempt TIMESTAMP NULL AFTER contact_attempts;

ALTER TABLE leads
ADD COLUMN is_archived BOOLEAN DEFAULT FALSE AFTER last_contact_attempt;

ALTER TABLE leads
ADD COLUMN archive_reason VARCHAR(100) NULL AFTER is_archived;

ALTER TABLE leads
ADD COLUMN converted_to_customer_id INT NULL AFTER archive_reason;

ALTER TABLE leads
ADD COLUMN conversion_date TIMESTAMP NULL AFTER converted_to_customer_id;

ALTER TABLE leads
ADD COLUMN trial_appointment_id INT NULL AFTER conversion_date;

ALTER TABLE leads
ADD COLUMN initial_package_size INT NULL AFTER trial_appointment_id;

-- Add indexes for performance
ALTER TABLE leads
ADD INDEX idx_leads_archived (is_archived, status);

ALTER TABLE leads
ADD INDEX idx_leads_stage (status, stage_entered_at);

-- Add foreign key for customer conversion tracking
ALTER TABLE leads
ADD CONSTRAINT fk_lead_customer
FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Map existing lead statuses to new workflow
UPDATE leads SET status = CASE
  WHEN status = 'neu' THEN 'new'
  WHEN status = 'kontaktiert' THEN 'working'
  WHEN status = 'konvertiert' THEN 'converted'
  ELSE status
END
WHERE status IN ('neu', 'kontaktiert', 'konvertiert');

-- Set archive flags for terminal states
UPDATE leads 
SET is_archived = TRUE,
    archive_reason = status,
    stage_entered_at = CURRENT_TIMESTAMP
WHERE status IN ('converted', 'not_interested', 'lost', 'unreachable', 'wrong_number');

-- Set stage_entered_at for active leads
UPDATE leads 
SET stage_entered_at = CURRENT_TIMESTAMP
WHERE is_archived = FALSE AND stage_entered_at IS NULL;

-- Clean up the enum to remove old German values
ALTER TABLE leads MODIFY COLUMN status 
ENUM('new', 'working', 'qualified', 'trial_scheduled', 
     'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost') 
DEFAULT 'new';

-- Verify the migration
SELECT 
    id,
    name,
    status,
    is_archived,
    archive_reason,
    contact_attempts,
    stage_entered_at
FROM leads
ORDER BY is_archived, status, id;