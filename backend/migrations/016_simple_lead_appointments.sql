-- Migration 016: Create Lead Appointments Table (Simplified)
-- Create lead_appointments table without triggers for initial setup

CREATE TABLE IF NOT EXISTS lead_appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  lead_id INT NOT NULL,
  appointment_type_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('geplant', 'abgeschlossen', 'nicht_erschienen', 'abgesagt') DEFAULT 'geplant',
  cancelled_by ENUM('lead', 'studio', 'system') NULL,
  cancelled_at TIMESTAMP NULL,
  notes TEXT,
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_lead_appointment_studio_date (studio_id, appointment_date),
  INDEX idx_lead_appointment_lead (lead_id),
  INDEX idx_lead_appointment_date_time (appointment_date, start_time),
  INDEX idx_lead_appointment_status (status),
  INDEX idx_lead_appointment_type (appointment_type_id),
  
  -- Foreign key constraints
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);