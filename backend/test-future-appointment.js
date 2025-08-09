#!/usr/bin/env node

/**
 * Test Future Appointment Status Change
 * Creates a future appointment and tests status change validation
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

// Test credentials
const testCredentials = {
    email: 'maxberger@ail.com',
    password: 'IchbinMax123'
};

let authToken = null;
let studioId = null;

async function login() {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCredentials)
    });
    
    if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
    }
    
    const data = await response.json();
    authToken = data.token;
    console.log(`✅ Logged in as ${data.user.email}`);
    return data;
}

async function getStudioInfo() {
    const response = await fetch(`${API_BASE_URL}/api/v1/studios/my-studio`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to get studio info: ${response.status}`);
    }
    
    const data = await response.json();
    studioId = data.studio.id;
    console.log(`✅ Studio: ${data.studio.name} (ID: ${studioId})`);
    return data.studio;
}

async function createFutureAppointment() {
    console.log('\n📅 Creating future appointment (2 hours from now)...');
    
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const endTime = new Date(futureTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const appointmentDate = futureTime.toISOString().split('T')[0];
    const startTimeStr = futureTime.toTimeString().slice(0, 5) + ':00';
    const endTimeStr = endTime.toTimeString().slice(0, 5) + ':00';
    
    // Get customers
    const customersResponse = await fetch(`${API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    const customersData = await customersResponse.json();
    if (!customersData.customers || customersData.customers.length === 0) {
        throw new Error('No customers found');
    }
    
    console.log(`Found ${customersData.customers.length} customers`);
    const customerId = customersData.customers[0].id || customersData.customers[0].user_id;
    console.log(`Using customer ID: ${customerId}`);
    
    // Get appointment types
    const typesResponse = await fetch(`${API_BASE_URL}/api/v1/appointments/studio/${studioId}/appointment-types`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    const typesData = await typesResponse.json();
    const behandlungType = typesData.appointmentTypes.find(t => t.name === 'Behandlung');
    
    // Create appointment
    const appointmentData = {
        studio_id: studioId,
        customer_id: customerId,
        appointment_type_id: behandlungType.id,
        appointment_date: appointmentDate,
        start_time: startTimeStr,
        end_time: endTimeStr
    };
    
    console.log('Creating appointment with data:', appointmentData);
    
    const response = await fetch(`${API_BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(appointmentData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create appointment: ${error.message}`);
    }
    
    const data = await response.json();
    console.log(`✅ Created appointment ID ${data.appointmentId}`);
    console.log(`   Date: ${appointmentDate}`);
    console.log(`   Start: ${startTimeStr}`);
    console.log(`   End: ${endTimeStr}`);
    
    return {
        id: data.appointmentId,
        startTime: futureTime,
        endTime: endTime
    };
}

async function testStatusChange(appointmentId, newStatus) {
    console.log(`\n🔄 Attempting to change status to "${newStatus}"...`);
    
    const response = await fetch(`${API_BASE_URL}/api/v1/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: newStatus })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.log(`❌ Status change failed: ${data.message}`);
        if (data.appointmentStart) {
            const start = new Date(data.appointmentStart);
            const current = new Date(data.currentTime);
            console.log(`   Appointment starts: ${start.toLocaleTimeString()}`);
            console.log(`   Current time: ${current.toLocaleTimeString()}`);
            console.log(`   Time until start: ${Math.round((start - current) / 60000)} minutes`);
        }
        return false;
    } else {
        console.log(`✅ Status changed successfully`);
        if (data.sessionDeducted) {
            console.log(`   📝 Session was deducted`);
        }
        return true;
    }
}

async function runTest() {
    try {
        // Login and setup
        await login();
        await getStudioInfo();
        
        // Create a future appointment
        const appointment = await createFutureAppointment();
        
        console.log('\n' + '='.repeat(60));
        console.log('🧪 Testing Status Change Validation');
        console.log('='.repeat(60));
        
        const now = new Date();
        console.log(`\nCurrent time: ${now.toLocaleTimeString()}`);
        console.log(`Appointment starts: ${appointment.startTime.toLocaleTimeString()}`);
        console.log(`Time until start: ${Math.round((appointment.startTime - now) / 60000)} minutes`);
        
        // Test 1: Try to mark as "nicht erschienen" before start time
        console.log('\n📋 Test 1: Mark as "nicht erschienen" BEFORE start time');
        console.log('Expected: Should FAIL (appointment hasn\'t started)');
        const result1 = await testStatusChange(appointment.id, 'nicht erschienen');
        console.log(`Result: ${result1 ? '❌ UNEXPECTED SUCCESS' : '✅ Failed as expected'}`);
        
        // Test 2: Try to mark as "abgeschlossen" before start time
        console.log('\n📋 Test 2: Mark as "abgeschlossen" BEFORE start time');
        console.log('Expected: Should SUCCEED (manual completion allowed)');
        const result2 = await testStatusChange(appointment.id, 'abgeschlossen');
        console.log(`Result: ${result2 ? '✅ Succeeded as expected' : '❌ UNEXPECTED FAILURE'}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Test completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
console.log('🧪 Future Appointment Status Change Test');
console.log('========================================\n');

runTest().catch(console.error);