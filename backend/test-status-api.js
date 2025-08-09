#!/usr/bin/env node

/**
 * API Test for Appointment Status Management
 * Tests the time-based status change rules via API
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

// Test credentials - using the manager account for testing
const testCredentials = {
    email: 'maxberger@ail.com',
    password: 'IchbinMax123'
};

let authToken = null;
let studioId = null;

async function login() {
    console.log('🔐 Logging in as studio owner...');
    
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
    
    console.log(`✅ Logged in successfully as ${data.user.email}`);
    return data;
}

async function getStudioInfo() {
    console.log('\n📋 Getting studio information...');
    
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

async function getAppointments() {
    console.log('\n📋 Getting appointments...');
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch(`${API_BASE_URL}/api/v1/appointments/studio/${studioId}?date=${today}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to get appointments: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.appointments.length} appointments for today`);
    
    return data.appointments;
}

async function testStatusChange(appointmentId, newStatus) {
    console.log(`\n🔄 Testing status change to "${newStatus}" for appointment ${appointmentId}...`);
    
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
            console.log(`   Appointment starts at: ${new Date(data.appointmentStart).toLocaleString()}`);
            console.log(`   Current time: ${new Date(data.currentTime).toLocaleString()}`);
        }
        return false;
    } else {
        console.log(`✅ Status changed successfully`);
        if (data.sessionDeducted) {
            console.log(`   📝 Session was deducted from customer account`);
        }
        return true;
    }
}

async function createTestAppointment(startOffsetMinutes) {
    console.log(`\n➕ Creating test appointment (starts in ${startOffsetMinutes} minutes)...`);
    
    const now = new Date();
    const startTime = new Date(now.getTime() + startOffsetMinutes * 60000);
    const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour duration
    
    const appointmentDate = startTime.toISOString().split('T')[0];
    const startTimeStr = startTime.toTimeString().slice(0, 5);
    const endTimeStr = endTime.toTimeString().slice(0, 5);
    
    // First, get a customer ID
    const customersResponse = await fetch(`${API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!customersResponse.ok) {
        console.log('❌ Failed to get customers');
        return null;
    }
    
    const customersData = await customersResponse.json();
    if (customersData.customers.length === 0) {
        console.log('❌ No customers found in studio');
        return null;
    }
    
    const customerId = customersData.customers[0].user_id;
    
    // Get appointment type ID for "Behandlung"
    const typesResponse = await fetch(`${API_BASE_URL}/api/v1/appointments/studio/${studioId}/appointment-types`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    if (!typesResponse.ok) {
        console.log('❌ Failed to get appointment types');
        return null;
    }
    
    const typesData = await typesResponse.json();
    const behandlungType = typesData.appointmentTypes.find(t => t.name === 'Behandlung');
    
    if (!behandlungType) {
        console.log('❌ Behandlung appointment type not found');
        return null;
    }
    
    // Create the appointment
    const response = await fetch(`${API_BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            studio_id: studioId,
            customer_id: customerId,
            appointment_type_id: behandlungType.id,
            appointment_date: appointmentDate,
            start_time: startTimeStr,
            end_time: endTimeStr
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        console.log(`❌ Failed to create appointment: ${error.message}`);
        return null;
    }
    
    const data = await response.json();
    console.log(`✅ Created test appointment ID ${data.appointmentId}`);
    console.log(`   Date: ${appointmentDate}`);
    console.log(`   Time: ${startTimeStr} - ${endTimeStr}`);
    
    return data.appointmentId;
}

async function runTests() {
    try {
        // Login
        await login();
        
        // Get studio info
        await getStudioInfo();
        
        // Get current appointments
        const appointments = await getAppointments();
        
        if (appointments.length > 0) {
            const now = new Date();
            
            // Analyze each appointment
            console.log('\n📊 Analyzing appointments by time:');
            
            for (const apt of appointments.slice(0, 5)) { // Limit to first 5
                const startTime = new Date(`${apt.appointment_date} ${apt.start_time}`);
                const endTime = new Date(`${apt.appointment_date} ${apt.end_time}`);
                const hasStarted = now >= startTime;
                const hasEnded = now >= endTime;
                
                console.log(`\n  Appointment ID ${apt.id}:`);
                console.log(`    Customer: ${apt.customer_first_name} ${apt.customer_last_name}`);
                console.log(`    Time: ${apt.start_time} - ${apt.end_time}`);
                console.log(`    Current Status: ${apt.status}`);
                console.log(`    Has Started: ${hasStarted ? 'Yes' : 'No'}`);
                console.log(`    Has Ended: ${hasEnded ? 'Yes' : 'No'}`);
                
                if (apt.status === 'confirmed' || apt.status === 'bestätigt') {
                    if (!hasStarted) {
                        console.log(`    → Cannot mark as "nicht erschienen" (not started yet)`);
                    } else {
                        console.log(`    → Can mark as "nicht erschienen" (has started)`);
                    }
                    
                    if (hasEnded) {
                        console.log(`    → Should be auto-updated to "abgeschlossen"`);
                    }
                }
            }
            
            // Find a confirmed appointment to test
            const testAppointment = appointments.find(a => 
                a.status === 'confirmed' || a.status === 'bestätigt'
            );
            
            if (testAppointment) {
                const startTime = new Date(`${testAppointment.appointment_date} ${testAppointment.start_time}`);
                const hasStarted = now >= startTime;
                
                console.log(`\n🧪 Testing status changes on appointment ${testAppointment.id}:`);
                
                // Test changing to "nicht erschienen"
                if (!hasStarted) {
                    console.log('\n  Test 1: Trying to mark as "nicht erschienen" before start time...');
                    await testStatusChange(testAppointment.id, 'nicht erschienen');
                    console.log('  Expected: Should fail (appointment hasn\'t started)');
                } else {
                    console.log('\n  Test 1: Trying to mark as "nicht erschienen" after start time...');
                    await testStatusChange(testAppointment.id, 'nicht erschienen');
                    console.log('  Expected: Should succeed (appointment has started)');
                }
            }
        } else {
            console.log('\n⚠️ No appointments found for today. Creating test appointments...');
            
            // Create a future appointment (starts in 30 minutes)
            const futureAppointmentId = await createTestAppointment(30);
            
            if (futureAppointmentId) {
                console.log('\nTesting future appointment (starts in 30 minutes):');
                await testStatusChange(futureAppointmentId, 'nicht erschienen');
                console.log('Expected: Should fail (appointment hasn\'t started)');
            }
            
            // Create a past appointment (started 30 minutes ago)
            const pastAppointmentId = await createTestAppointment(-30);
            
            if (pastAppointmentId) {
                console.log('\nTesting past appointment (started 30 minutes ago):');
                await testStatusChange(pastAppointmentId, 'nicht erschienen');
                console.log('Expected: Should succeed (appointment has started)');
            }
        }
        
        console.log('\n✅ All tests completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tests
console.log('🧪 Starting Appointment Status Management API Tests...');
console.log('=====================================================\n');

runTests().catch(console.error);