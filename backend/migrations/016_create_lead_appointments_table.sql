-- Migration 016: Create Lead Appointments Table
-- Separate table for lead/trial appointments with full feature parity to customer appointments

-- Create lead_appointments table
CREATE TABLE lead_appointments (
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
  
  -- Indexes for performance (mirroring appointments table)
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

-- Add trigger to validate lead appointment constraints
DELIMITER $$

DROP TRIGGER IF EXISTS lead_appointment_validation$$

CREATE TRIGGER lead_appointment_validation
BEFORE INSERT ON lead_appointments
FOR EACH ROW
BEGIN
    -- Ensure appointment is not in the past
    IF NEW.appointment_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Lead appointments cannot be scheduled in the past';
    END IF;
    
    -- Ensure start_time is before end_time
    IF NEW.start_time >= NEW.end_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Start time must be before end time';
    END IF;
    
    -- Ensure appointment type belongs to the same studio
    IF NOT EXISTS (
        SELECT 1 FROM appointment_types 
        WHERE id = NEW.appointment_type_id AND studio_id = NEW.studio_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Appointment type must belong to the same studio';
    END IF;
    
    -- Ensure lead belongs to the same studio
    IF NOT EXISTS (
        SELECT 1 FROM leads 
        WHERE id = NEW.lead_id AND studio_id = NEW.studio_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Lead must belong to the same studio';
    END IF;
END$$

DROP TRIGGER IF EXISTS lead_appointment_validation_update$$

CREATE TRIGGER lead_appointment_validation_update
BEFORE UPDATE ON lead_appointments
FOR EACH ROW
BEGIN
    -- Ensure start_time is before end_time
    IF NEW.start_time >= NEW.end_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Start time must be before end time';
    END IF;
    
    -- Ensure appointment type belongs to the same studio
    IF NOT EXISTS (
        SELECT 1 FROM appointment_types 
        WHERE id = NEW.appointment_type_id AND studio_id = NEW.studio_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Appointment type must belong to the same studio';
    END IF;
END$$

DELIMITER ;

-- Verification query
SELECT 
    'Migration 016 completed - lead_appointments table created with full feature parity' as status,
    COUNT(*) as lead_appointments_count
FROM lead_appointments;

-- Show table structure for verification
DESCRIBE lead_appointments;