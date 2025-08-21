-- Add archive_date field to leads table to track when a lead was archived
ALTER TABLE leads ADD COLUMN archive_date DATETIME DEFAULT NULL;

-- Create an index for better query performance on archived leads
ALTER TABLE leads ADD INDEX idx_leads_archive_date (archive_date);

-- Update existing archived leads to set archive_date to stage_entered_at
-- This provides a reasonable default for existing archived leads
UPDATE leads 
SET archive_date = stage_entered_at 
WHERE is_archived = TRUE AND archive_date IS NULL;