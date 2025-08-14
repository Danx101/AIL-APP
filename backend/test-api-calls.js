#!/usr/bin/env node

/**
 * Test actual API endpoints to reproduce the errors
 */

const http = require('http');

const API_PORT = process.env.PORT || 3001;
const API_HOST = 'localhost';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAPIs() {
  console.log('🧪 Testing API endpoints directly...\n');
  
  // First, we need a token - let's skip auth for testing
  console.log('Testing without authentication (to isolate the issue)...\n');
  
  // Test 1: Appointments endpoint
  console.log('1️⃣ Testing GET /api/v1/appointments/studio/1...');
  
  try {
    const result = await makeRequest({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/v1/appointments/studio/1?date=' + new Date().toISOString().split('T')[0],
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${result.status}`);
    if (result.status === 500) {
      console.log('   ❌ 500 Error - Server error');
      console.log('   Response:', result.body);
    } else if (result.status === 401) {
      console.log('   ⚠️  401 - Authentication required (expected)');
    } else {
      console.log('   ✅ Endpoint accessible');
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  // Test 2: Check if server is running
  console.log('\n2️⃣ Testing server health...');
  
  try {
    const result = await makeRequest({
      hostname: API_HOST,
      port: API_PORT,
      path: '/health',
      method: 'GET'
    });
    
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log('   ✅ Server is running');
    } else {
      console.log('   ⚠️  Unexpected status');
    }
  } catch (error) {
    console.log('   ❌ Server may not be running:', error.message);
    console.log('\n⚠️  Please ensure the backend server is running on port', API_PORT);
    console.log('   Run: npm start (in backend directory)');
  }
  
  // Test 3: Check routes structure
  console.log('\n3️⃣ Checking available routes...');
  
  const testRoutes = [
    '/api/v1/customers',
    '/api/v1/appointments',
    '/api/v1/studios'
  ];
  
  for (const route of testRoutes) {
    try {
      const result = await makeRequest({
        hostname: API_HOST,
        port: API_PORT,
        path: route,
        method: 'GET'
      });
      
      console.log(`   ${route}: ${result.status}`);
    } catch (error) {
      console.log(`   ${route}: ❌ Failed`);
    }
  }
  
  console.log('\n✅ API test complete!');
  
  // Provide recommendations
  console.log('\n📋 RECOMMENDATIONS:');
  console.log('1. Check that backend server is running');
  console.log('2. Check authentication middleware for errors');
  console.log('3. Review server logs for detailed error messages');
  console.log('4. Ensure database connections are working');
}

testAPIs();