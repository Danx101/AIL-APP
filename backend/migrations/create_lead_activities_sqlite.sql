-- Create lead_activities table for SQLite
CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  studio_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('status_change', 'call', 'email', 'sms', 'note', 'appointment_scheduled', 'appointment_completed', 'conversion', 'archive', 'new', 'moved', 'reactivated')),
  description TEXT,
  from_status TEXT,
  to_status TEXT,
  metadata TEXT, -- JSON stored as TEXT in SQLite
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_activities ON lead_activities(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_type ON lead_activities(activity_type, studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_date ON lead_activities(studio_id, created_at DESC);