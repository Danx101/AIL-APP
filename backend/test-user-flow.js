#!/usr/bin/env node

const fetch = require('node-fetch');

async function testUserFlow() {
  const API_BASE = 'http://localhost:3001';
  
  console.log('🔧 Testing User Flow...\n');

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in as maxberger@ail.com...');
    const loginResponse = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'maxberger@ail.com',
        password: 'IchbinMax123'
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('❌ Login failed:', error);
      return;
    }

    const loginData = await loginResponse.json();
    const authToken = loginData.token;
    console.log('✅ Login successful');
    console.log('   User ID:', loginData.user.id);
    console.log('   Email:', loginData.user.email);
    console.log('   Role:', loginData.user.role);
    console.log('   Name:', loginData.user.firstName, loginData.user.lastName);

    // Step 2: Check what endpoints this user can access
    console.log('\n2️⃣ Checking user access...');
    
    // Try to get studio (for studio owners)
    if (loginData.user.role === 'studio_owner') {
      const studioResponse = await fetch(`${API_BASE}/api/v1/studios/my-studio`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (studioResponse.ok) {
        const studioData = await studioResponse.json();
        console.log('✅ Studio found:', studioData.studio.name, `(ID: ${studioData.studio.id})`);
      } else {
        console.log('❌ No studio found for this user');
      }
    }

    // Check if user is a customer
    if (loginData.user.role === 'customer') {
      console.log('\n3️⃣ Customer detected. Checking customer data...');
      
      // Try to get customer info
      const customerResponse = await fetch(`${API_BASE}/api/v1/customers/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log('✅ Customer data:', customerData);
      } else {
        console.log('❌ Failed to get customer data:', await customerResponse.text());
      }

      // Try to get customer's studio
      const sessionResponse = await fetch(`${API_BASE}/api/v1/customers/me/sessions`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        console.log('✅ Customer sessions:', sessionData);
      } else {
        console.log('❌ Failed to get customer sessions:', await sessionResponse.text());
      }
    }

    // Step 3: Check what's needed for appointment booking
    console.log('\n4️⃣ Checking appointment booking requirements...');
    console.log('   For customers to book appointments, they need:');
    console.log('   - A studio they are associated with');
    console.log('   - Active session blocks (for Behandlung)');
    console.log('   - Access to appointment types for their studio');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUserFlow();