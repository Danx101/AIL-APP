const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api/v1';

async function testManagerAPI() {
  try {
    console.log('🔐 Testing Manager API endpoints...\n');

    // Step 1: Login as manager
    console.log('1. Logging in as manager...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'manager@example.com',
      password: 'manager123',
      role: 'manager'
    });

    const { token } = loginResponse.data;
    console.log('✅ Login successful! Token received.\n');

    // Configure axios with auth header
    const authAxios = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Step 2: Test manager stats endpoint
    console.log('2. Testing /manager/leads/stats endpoint...');
    try {
      const statsResponse = await authAxios.get('/manager/leads/stats');
      console.log('✅ Stats response:', statsResponse.data);
    } catch (error) {
      console.error('❌ Stats error:', error.response?.data || error.message);
    }

    // Step 3: Test studios endpoint
    console.log('\n3. Testing /manager/studios endpoint...');
    try {
      const studiosResponse = await authAxios.get('/manager/studios');
      console.log('✅ Studios response:', studiosResponse.data);
    } catch (error) {
      console.error('❌ Studios error:', error.response?.data || error.message);
    }

    // Step 4: Test Google Sheets integrations endpoint
    console.log('\n4. Testing /manager/google-sheets endpoint...');
    try {
      const sheetsResponse = await authAxios.get('/manager/google-sheets');
      console.log('✅ Google Sheets integrations:', sheetsResponse.data);
    } catch (error) {
      console.error('❌ Google Sheets error:', error.response?.data || error.message);
    }

    // Step 5: Test cities endpoint
    console.log('\n5. Testing /manager/cities endpoint...');
    try {
      const citiesResponse = await authAxios.get('/manager/cities');
      console.log('✅ Cities response:', citiesResponse.data);
    } catch (error) {
      console.error('❌ Cities error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Hint: Make sure the manager account exists. Run this SQL:');
      console.log("INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ('manager@example.com', '$2b$10$YourHashHere', 'manager', 'Admin', 'Manager');");
    }
  }
}

// Run the test
testManagerAPI();