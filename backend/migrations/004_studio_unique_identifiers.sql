-- Migration 004: Studio Unique Identifier System
-- This adds unique identifiers to studios for use in registration codes
-- Format: City-based codes like BER, MUC, HAM, FRA

-- Add unique identifier column to studios table
ALTER TABLE studios 
ADD COLUMN unique_identifier VARCHAR(20) UNIQUE AFTER name;

-- Add index for faster lookups
ALTER TABLE studios
ADD INDEX idx_studio_identifier (unique_identifier);

-- Generate unique identifiers for existing studios based on city
-- We'll use city-based prefixes for better readability
UPDATE studios SET unique_identifier = 
  CASE 
    WHEN name LIKE '%Berlin%' OR city = 'Berlin' THEN 'BER'
    WHEN name LIKE '%Munich%' OR name LIKE '%München%' OR city = 'Munich' OR city = 'München' THEN 'MUC'
    WHEN name LIKE '%Hamburg%' OR city = 'Hamburg' THEN 'HAM'
    WHEN name LIKE '%Frankfurt%' OR city = 'Frankfurt' THEN 'FRA'
    WHEN name LIKE '%Cologne%' OR name LIKE '%Köln%' OR city = 'Cologne' OR city = 'Köln' THEN 'CGN'
    WHEN name LIKE '%Stuttgart%' OR city = 'Stuttgart' THEN 'STR'
    WHEN name LIKE '%Düsseldorf%' OR city = 'Düsseldorf' THEN 'DUS'
    WHEN name LIKE '%Leipzig%' OR city = 'Leipzig' THEN 'LEJ'
    WHEN name LIKE '%Dresden%' OR city = 'Dresden' THEN 'DRS'
    WHEN name LIKE '%Hannover%' OR city = 'Hannover' OR city = 'Hanover' THEN 'HAJ'
    ELSE CONCAT('STU', id)  -- Fallback for unknown cities
  END
WHERE unique_identifier IS NULL;

-- Verify all studios have unique identifiers
SELECT id, name, city, unique_identifier 
FROM studios 
ORDER BY id;