-- Migration 008: Lead Activities Tracking Table
-- Create table to track all lead activities and interactions

CREATE TABLE IF NOT EXISTS lead_activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lead_id INT NOT NULL,
  studio_id INT NOT NULL,
  activity_type ENUM('status_change', 'call', 'email', 'sms', 'note', 
                     'appointment_scheduled', 'appointment_completed', 
                     'conversion', 'archive') NOT NULL,
  description TEXT,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  metadata JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead_activities (lead_id, created_at),
  INDEX idx_activity_type (activity_type, studio_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Verify the table was created
SELECT 
    'lead_activities table created' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND table_name = 'lead_activities';