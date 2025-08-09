#!/usr/bin/env node

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001/api/v1';

async function testSessionDeduction() {
  console.log('\n🔬 Testing Session Deduction Feature\n');
  console.log('=====================================\n');

  // Step 1: Login as Max Berger
  console.log('📋 Step 1: Logging in as Max Berger (maxberger@ail.com)...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'maxberger@ail.com',
      password: 'IchbinMax123'
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', await loginResponse.text());
    return;
  }

  const { token } = await loginResponse.json();
  console.log('✅ Logged in successfully!\n');

  // Step 2: Get studio appointments
  console.log('📋 Step 2: Fetching today\'s appointments...');
  const today = new Date().toISOString().split('T')[0];
  const appointmentsResponse = await fetch(`${API_URL}/appointments/studio/3?date=${today}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!appointmentsResponse.ok) {
    console.error('❌ Failed to fetch appointments:', await appointmentsResponse.text());
    return;
  }

  const { appointments } = await appointmentsResponse.json();
  console.log(`✅ Found ${appointments.length} appointments for today\n`);

  if (appointments.length === 0) {
    console.log('⚠️  No appointments found for today. Please create some appointments first.');
    return;
  }

  // Find a confirmed appointment
  const confirmedAppointment = appointments.find(apt => 
    apt.status === 'bestätigt' || apt.status === 'confirmed'
  );

  if (!confirmedAppointment) {
    console.log('⚠️  No confirmed appointments found to test with.');
    return;
  }

  console.log(`📋 Step 3: Testing status update for appointment ID ${confirmedAppointment.id}`);
  console.log(`   Customer: ${confirmedAppointment.customer_first_name} ${confirmedAppointment.customer_last_name}`);
  console.log(`   Type: ${confirmedAppointment.appointment_type_name}`);
  console.log(`   Time: ${confirmedAppointment.start_time} - ${confirmedAppointment.end_time}`);
  console.log(`   Current Status: ${confirmedAppointment.status}\n`);

  // Step 3: Get customer's current session balance
  console.log('📋 Step 4: Checking customer\'s session balance before status update...');
  const customerSessionsResponse = await fetch(`${API_URL}/customers/${confirmedAppointment.customer_id}/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  let sessionsBefore = 0;
  if (customerSessionsResponse.ok) {
    const { sessions } = await customerSessionsResponse.json();
    const activeSession = sessions.find(s => s.is_active);
    if (activeSession) {
      sessionsBefore = activeSession.remaining_sessions;
      console.log(`✅ Current active session block: ${sessionsBefore} sessions remaining\n`);
    } else {
      console.log('⚠️  No active session block found for this customer\n');
    }
  }

  // Step 4: Update appointment status to "abgeschlossen" (completed)
  console.log('📋 Step 5: Updating appointment status to "abgeschlossen" (completed)...');
  const statusUpdateResponse = await fetch(`${API_URL}/appointments/${confirmedAppointment.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'abgeschlossen' })
  });

  if (!statusUpdateResponse.ok) {
    console.error('❌ Failed to update status:', await statusUpdateResponse.text());
    return;
  }

  const statusResult = await statusUpdateResponse.json();
  console.log('✅ Status updated successfully!');
  console.log(`   Session deducted: ${statusResult.sessionDeducted ? 'Yes' : 'No'}\n`);

  // Step 5: Check session balance after update
  console.log('📋 Step 6: Checking customer\'s session balance after status update...');
  const customerSessionsAfterResponse = await fetch(`${API_URL}/customers/${confirmedAppointment.customer_id}/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  let sessionsAfter = 0;
  if (customerSessionsAfterResponse.ok) {
    const { sessions } = await customerSessionsAfterResponse.json();
    const activeSession = sessions.find(s => s.is_active);
    if (activeSession) {
      sessionsAfter = activeSession.remaining_sessions;
      console.log(`✅ Updated active session block: ${sessionsAfter} sessions remaining\n`);
    }
  }

  // Step 6: Verify session was deducted
  console.log('\n=====================================');
  console.log('📊 Test Results:');
  console.log('=====================================');
  console.log(`Sessions before: ${sessionsBefore}`);
  console.log(`Sessions after:  ${sessionsAfter}`);
  console.log(`Sessions deducted: ${sessionsBefore - sessionsAfter}`);
  
  if (sessionsBefore > sessionsAfter) {
    console.log('\n✅ SUCCESS: Session was correctly deducted when appointment was marked as completed!');
  } else if (sessionsBefore === 0) {
    console.log('\n⚠️  WARNING: Customer had no sessions to deduct. Session deduction could not be tested.');
  } else {
    console.log('\n❌ FAILURE: Session was NOT deducted. Please check the implementation.');
  }
}

// Run the test
testSessionDeduction().catch(console.error);