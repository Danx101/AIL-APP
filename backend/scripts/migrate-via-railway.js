#!/usr/bin/env node

const fetch = require('node-fetch');

async function migrateViaRailway() {
  console.log('🚀 Triggering data migration via Railway app...\n');

  const baseUrl = 'https://ail-app-production.up.railway.app';
  
  try {
    // Create a special endpoint to trigger migration
    console.log('📋 Calling migration endpoint...');
    const response = await fetch(`${baseUrl}/api/v1/db/migrate-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ secret: 'migrate-2025' })
    });

    const result = await response.json();
    console.log('Response:', result);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Alternative: Show what needs to be done manually
console.log('📝 Manual migration steps:\n');
console.log('1. The MySQL database already has the correct schema');
console.log('2. Appointment types table exists with columns: id, name, duration, description, studio_id, etc.');
console.log('3. You can create appointment types directly via the app UI');
console.log('4. Or run these SQL commands in Railway MySQL:\n');

const sqlCommands = `
-- Create default appointment types for Studio 3
INSERT INTO appointment_types (name, duration, description, studio_id, color, is_active, created_at, updated_at)
VALUES 
  ('Erstbehandlung', 90, 'Erste Behandlung für neue Kunden', 3, '#007bff', 1, NOW(), NOW()),
  ('Folgebehandlung', 60, 'Reguläre Folgebehandlung', 3, '#28a745', 1, NOW(), NOW()),
  ('Beratungsgespräch', 30, 'Kostenloses Beratungsgespräch', 3, '#ffc107', 1, NOW(), NOW());
`;

console.log(sqlCommands);