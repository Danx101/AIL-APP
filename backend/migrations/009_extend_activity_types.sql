-- Migration 009: Extend Activity Types for Lead Activities
-- Add new activity types for better tracking

-- Alter the enum to include new activity types
ALTER TABLE lead_activities 
MODIFY COLUMN activity_type ENUM(
  'status_change', 
  'call', 
  'email', 
  'sms', 
  'note', 
  'appointment_scheduled', 
  'appointment_completed', 
  'conversion', 
  'archive',
  'new',           -- For newly created leads
  'moved',         -- For leads moved to working statuses
  'reactivated'    -- For leads reactivated from archive
) NOT NULL;

-- Verify the change
SELECT 
    'activity_type enum updated' as status,
    COLUMN_TYPE as new_types
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND table_name = 'lead_activities'
AND column_name = 'activity_type';