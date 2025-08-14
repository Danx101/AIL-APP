-- Migration 007: Appointments Table Enhancement
-- Add support for both leads and customers in appointments

-- Add lead_id column to support lead appointments
ALTER TABLE appointments 
ADD COLUMN lead_id INT NULL AFTER customer_id;

-- Add person_type to clearly identify appointment type
ALTER TABLE appointments
ADD COLUMN person_type ENUM('customer', 'lead') DEFAULT 'customer' AFTER lead_id;

-- Add indexes for performance
ALTER TABLE appointments
ADD INDEX idx_appointment_lead (lead_id);

ALTER TABLE appointments
ADD INDEX idx_appointment_person_type (person_type, appointment_date);

-- Add foreign key constraint for lead appointments
ALTER TABLE appointments
ADD CONSTRAINT fk_appointment_lead 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Update existing appointments to set person_type
UPDATE appointments 
SET person_type = 'customer'
WHERE customer_id IS NOT NULL;

-- Add check constraint to ensure either customer_id or lead_id is set, but not both
-- Note: MySQL doesn't support CHECK constraints before 8.0.16, so we'll handle this in application logic
-- For MySQL 8.0.16+:
-- ALTER TABLE appointments 
-- ADD CONSTRAINT chk_person_reference CHECK (
--   (person_type = 'customer' AND customer_id IS NOT NULL AND lead_id IS NULL) OR
--   (person_type = 'lead' AND lead_id IS NOT NULL AND customer_id IS NULL)
-- );

-- Create a trigger to validate the constraint for older MySQL versions
DELIMITER $$

DROP TRIGGER IF EXISTS appointment_person_validation$$

CREATE TRIGGER appointment_person_validation
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NEW.person_type = 'customer' THEN
        IF NEW.customer_id IS NULL OR NEW.lead_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Customer appointments must have customer_id and no lead_id';
        END IF;
    ELSEIF NEW.person_type = 'lead' THEN
        IF NEW.lead_id IS NULL OR NEW.customer_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Lead appointments must have lead_id and no customer_id';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS appointment_person_validation_update$$

CREATE TRIGGER appointment_person_validation_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
    IF NEW.person_type = 'customer' THEN
        IF NEW.customer_id IS NULL OR NEW.lead_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Customer appointments must have customer_id and no lead_id';
        END IF;
    ELSEIF NEW.person_type = 'lead' THEN
        IF NEW.lead_id IS NULL OR NEW.customer_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Lead appointments must have lead_id and no customer_id';
        END IF;
    END IF;
END$$

DELIMITER ;

-- Verify the migration
SELECT 
    a.id,
    a.person_type,
    a.customer_id,
    a.lead_id,
    a.appointment_date,
    a.start_time,
    CASE 
        WHEN a.person_type = 'customer' THEN CONCAT(c.contact_first_name, ' ', c.contact_last_name)
        WHEN a.person_type = 'lead' THEN l.name
    END as person_name
FROM appointments a
LEFT JOIN customers c ON a.customer_id = c.id
LEFT JOIN leads l ON a.lead_id = l.id
ORDER BY a.appointment_date DESC, a.start_time DESC
LIMIT 10;