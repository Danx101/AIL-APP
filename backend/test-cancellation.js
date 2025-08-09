#!/usr/bin/env node

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testCancellation() {
    // Login
    const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'maxberger@ail.com', password: 'IchbinMax123' })
    });
    const { token } = await loginRes.json();
    console.log('✅ Logged in');
    
    // Try to cancel appointment 40
    console.log('\n🔄 Testing cancellation of appointment 40...');
    
    const cancelRes = await fetch(`${API_BASE_URL}/api/v1/appointments/40`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (cancelRes.ok) {
        const result = await cancelRes.json();
        console.log('✅ Cancellation successful:', result.message);
    } else {
        console.log(`❌ Cancellation failed: ${cancelRes.status} ${cancelRes.statusText}`);
        const error = await cancelRes.text();
        console.log('Error:', error);
    }
    
    // Check the appointment status
    const checkRes = await fetch(`${API_BASE_URL}/api/v1/appointments/40`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (checkRes.ok) {
        const { appointment } = await checkRes.json();
        console.log(`\n📋 Appointment 40 status: ${appointment.status}`);
    }
}

testCancellation().catch(console.error);