#!/usr/bin/env node

const fetch = require('node-fetch');

async function addDefaultAppointmentTypes() {
  console.log('🚀 Adding default appointment types...\n');

  const baseUrl = 'https://ail-app-production.up.railway.app';
  
  try {
    // First delete existing appointment types
    console.log('📋 Clearing existing appointment types...');
    const deleteResponse = await fetch(`${baseUrl}/api/v1/db/clear-appointment-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Cleared existing appointment types');
    }

    // Now create the two default types
    console.log('\n📋 Creating default appointment types...');
    const createResponse = await fetch(`${baseUrl}/api/v1/db/create-appointment-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        types: [
          { name: 'Behandlung', duration: 60, description: 'Standard Behandlung' },
          { name: 'Beratung', duration: 30, description: 'Beratungsgespräch' }
        ]
      })
    });

    const result = await createResponse.json();
    console.log('Response:', result);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addDefaultAppointmentTypes();