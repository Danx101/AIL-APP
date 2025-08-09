#!/usr/bin/env node

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testStatusChange() {
    // Login
    const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'maxberger@ail.com', password: 'IchbinMax123' })
    });
    const { token } = await loginRes.json();
    
    // Get appointment 34 (future appointment at 16:00)
    const aptRes = await fetch(`${API_BASE_URL}/api/v1/appointments/34`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const { appointment } = await aptRes.json();
    
    console.log('Appointment details:');
    console.log(`  ID: ${appointment.id}`);
    console.log(`  Date: ${appointment.appointment_date}`);
    console.log(`  Time: ${appointment.start_time} - ${appointment.end_time}`);
    console.log(`  Status: ${appointment.status}`);
    
    const now = new Date();
    const startTime = new Date(`${appointment.appointment_date} ${appointment.start_time}`);
    console.log(`\nCurrent time: ${now.toISOString()}`);
    console.log(`Appointment starts: ${startTime.toISOString()}`);
    console.log(`Has started: ${now >= startTime}`);
    
    // Try to change to "nicht erschienen"
    console.log('\nAttempting to mark as "nicht erschienen"...');
    const statusRes = await fetch(`${API_BASE_URL}/api/v1/appointments/34/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'nicht erschienen' })
    });
    
    const result = await statusRes.json();
    if (statusRes.ok) {
        console.log('✅ Success (unexpected!)');
    } else {
        console.log(`❌ Failed: ${result.message}`);
    }
}

testStatusChange().catch(console.error);