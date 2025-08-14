#!/usr/bin/env node

/**
 * Test script for customer creation with session packages
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

// Test credentials - update with your actual login
const TEST_CREDENTIALS = {
    email: 'maxberger@ail.com',
    password: 'IchbinMax123'
};

let authToken = null;
let testStudioId = null;

async function login() {
    console.log('🔐 Attempting login...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_CREDENTIALS)
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Login failed:', error);
            console.log('\n⚠️  Please update TEST_CREDENTIALS in this script with valid credentials');
            return false;
        }
        
        const data = await response.json();
        authToken = data.token;
        testStudioId = data.user.studio_id || 3; // Default to 3 if not in response
        
        console.log('✅ Login successful');
        console.log(`   Studio ID: ${testStudioId}`);
        console.log(`   User: ${data.user.email}`);
        return true;
    } catch (error) {
        console.error('❌ Login error:', error.message);
        return false;
    }
}

async function getStudioInfo() {
    console.log('\n📋 Getting studio information...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/studios/my-studios`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            console.error('❌ Failed to get studio info');
            return null;
        }
        
        const data = await response.json();
        const studios = data.studios || [];
        
        if (studios.length === 0) {
            console.error('❌ No studios found for user');
            return null;
        }
        
        const studio = studios[0]; // Get first studio
        testStudioId = studio.id;
        
        console.log('✅ Studio info retrieved:');
        console.log(`   Name: ${studio.name}`);
        console.log(`   ID: ${studio.id}`);
        console.log(`   Unique Identifier: ${studio.unique_identifier || 'Not set'}`);
        
        return studio;
    } catch (error) {
        console.error('❌ Get studio error:', error.message);
        return null;
    }
}

async function createTestCustomer() {
    console.log('\n👤 Creating test customer...');
    
    const timestamp = Date.now();
    const customerData = {
        firstName: 'Test',
        lastName: `Customer${timestamp}`,
        phone: `555${timestamp.toString().slice(-7)}`,
        email: `test${timestamp}@example.com`,
        sessionPackage: 10,  // 10 sessions
        paymentMethod: 'cash',
        notes: 'Created by automated test script'
    };
    
    console.log('   Customer data:', customerData);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/studios/${testStudioId}/customers`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        const responseText = await response.text();
        
        if (!response.ok) {
            console.error('❌ Failed to create customer:');
            console.error(`   Status: ${response.status}`);
            console.error(`   Response: ${responseText}`);
            return false;
        }
        
        const result = JSON.parse(responseText);
        console.log('✅ Customer created successfully!');
        console.log(`   Customer ID: ${result.customer.id}`);
        console.log(`   Registration Code: ${result.customer.registration_code}`);
        console.log(`   Name: ${result.customer.name}`);
        console.log(`   Sessions: ${result.customer.total_sessions_purchased}`);
        console.log(`   Instructions: ${result.instructions}`);
        
        return result.customer;
    } catch (error) {
        console.error('❌ Create customer error:', error.message);
        return false;
    }
}

async function listCustomers() {
    console.log('\n📋 Listing all customers...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/studios/${testStudioId}/customers`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            console.error('❌ Failed to list customers');
            return;
        }
        
        const data = await response.json();
        const customers = data.customers || [];
        
        console.log(`✅ Found ${customers.length} customers:`);
        customers.slice(0, 5).forEach(customer => {
            console.log(`   - ${customer.contact_first_name} ${customer.contact_last_name} (${customer.registration_code || 'No code'})`);
        });
        
        if (customers.length > 5) {
            console.log(`   ... and ${customers.length - 5} more`);
        }
    } catch (error) {
        console.error('❌ List customers error:', error.message);
    }
}

async function runTests() {
    console.log('🚀 Customer Creation Test Script');
    console.log('=================================\n');
    
    // Step 1: Login
    if (!await login()) {
        console.log('\n❌ Test aborted: Could not login');
        console.log('Please update the TEST_CREDENTIALS in this script');
        return;
    }
    
    // Step 2: Get studio info
    const studio = await getStudioInfo();
    if (!studio) {
        console.log('\n⚠️  Could not get studio info, using default studio ID:', testStudioId);
    }
    
    // Step 3: Create test customer
    const customer = await createTestCustomer();
    if (!customer) {
        console.log('\n❌ Test failed: Could not create customer');
        return;
    }
    
    // Step 4: List customers to verify
    await listCustomers();
    
    console.log('\n=================================');
    console.log('✅ All tests completed successfully!');
    console.log('\nYou can now:');
    console.log('1. Check the Customers tab in the web app');
    console.log('2. The new customer should appear in the list');
    console.log(`3. Customer can register in app with code: ${customer.registration_code}`);
}

// Run the tests
runTests().catch(console.error);