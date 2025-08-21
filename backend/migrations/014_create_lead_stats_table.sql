-- Migration 014: Create Lead Stats Table for 30-Day Metrics
-- Date: 2025-01-19
-- Description: Create minimal stats tracking table for persistent 30-day metrics

-- Create lead_stats table for essential metrics tracking
CREATE TABLE IF NOT EXISTS lead_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  studio_id INT NOT NULL,
  lead_id INT NOT NULL,
  event_type ENUM('created', 'converted') NOT NULL,
  event_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_studio_event_date (studio_id, event_type, event_date),
  INDEX idx_lead_id (lead_id),
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Verify the table was created
SELECT 
    'lead_stats table created' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND table_name = 'lead_stats';