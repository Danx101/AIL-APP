#!/usr/bin/env node

/**
 * Test frontend customer creation with exact same data structure
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
    email: 'maxberger@ail.com',
    password: 'IchbinMax123'
};

let authToken = null;
let studioId = 3;

async function login() {
    console.log('🔐 Logging in...');
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_CREDENTIALS)
    });
    
    if (!response.ok) {
        throw new Error('Login failed');
    }
    
    const data = await response.json();
    authToken = data.token;
    console.log('✅ Login successful');
    return authToken;
}

async function testFrontendCustomerCreation() {
    console.log('👤 Testing frontend customer creation...');
    
    // This mimics exactly what the CustomerManagement component sends
    const customerData = {
        firstName: "Frontend",
        lastName: "TestUser", 
        phone: "555-123-4567",
        email: "frontend@test.com",
        sessionPackage: 20, // parseInt() converts string to number
        paymentMethod: "cash",
        notes: "Created via frontend simulation"
    };
    
    console.log('📤 Sending customer data:', customerData);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        const responseText = await response.text();
        console.log('📥 Response status:', response.status);
        console.log('📥 Response body:', responseText);
        
        if (!response.ok) {
            console.error('❌ Request failed');
            return false;
        }
        
        const result = JSON.parse(responseText);
        console.log('✅ Customer created successfully!');
        console.log('   ID:', result.customer.id);
        console.log('   Registration Code:', result.customer.registration_code);
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testWithPotentialIssues() {
    console.log('\n🧪 Testing potential validation issues...');
    
    // Test cases that might cause validation errors
    const testCases = [
        {
            name: "Missing paymentMethod",
            data: {
                firstName: "Test",
                lastName: "User", 
                phone: "555-123-4567",
                email: "test@test.com",
                sessionPackage: 10
                // Missing paymentMethod
            }
        },
        {
            name: "Invalid sessionPackage",
            data: {
                firstName: "Test",
                lastName: "User", 
                phone: "555-123-4567", 
                email: "test@test.com",
                sessionPackage: 15, // Invalid value
                paymentMethod: "cash"
            }
        },
        {
            name: "Empty firstName",
            data: {
                firstName: "",
                lastName: "User",
                phone: "555-123-4567",
                email: "test@test.com", 
                sessionPackage: 10,
                paymentMethod: "cash"
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.name}`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testCase.data)
            });
            
            const responseText = await response.text();
            
            if (response.status === 400) {
                console.log('   ❌ Validation error (expected):', responseText);
            } else if (response.status === 201) {
                console.log('   ✅ Unexpectedly succeeded');
            } else {
                console.log(`   ⚠️  Unexpected status ${response.status}:`, responseText);
            }
            
        } catch (error) {
            console.log('   💥 Request error:', error.message);
        }
    }
}

async function run() {
    try {
        await login();
        await testFrontendCustomerCreation();
        await testWithPotentialIssues();
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

run();