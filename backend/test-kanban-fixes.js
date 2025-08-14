#!/usr/bin/env node

/**
 * Test script to verify Kanban lead movement and archiving fixes
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';
const TEST_STUDIO_ID = 'ABC123';

// Test credentials (you'll need to update these with valid ones)
const TEST_AUTH = {
    email: 'test@studio.com',
    password: 'Test123!@#'
};

let authToken = null;
let testLeadId = null;

async function login() {
    console.log('🔐 Logging in...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_AUTH)
        });
        
        if (!response.ok) {
            console.error('❌ Login failed:', await response.text());
            return false;
        }
        
        const data = await response.json();
        authToken = data.token;
        console.log('✅ Login successful');
        return true;
    } catch (error) {
        console.error('❌ Login error:', error.message);
        return false;
    }
}

async function createTestLead() {
    console.log('\n📝 Creating test lead...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/leads`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Test Lead ' + Date.now(),
                phone_number: '5551234567',
                email: 'testlead@example.com',
                status: 'new',
                source: 'manual',
                studio_id: TEST_STUDIO_ID
            })
        });
        
        if (!response.ok) {
            console.error('❌ Failed to create lead:', await response.text());
            return false;
        }
        
        const data = await response.json();
        testLeadId = data.id;
        console.log(`✅ Created test lead with ID: ${testLeadId}`);
        return true;
    } catch (error) {
        console.error('❌ Create lead error:', error.message);
        return false;
    }
}

async function testLeadMovement() {
    console.log('\n🔄 Testing lead movement...');
    
    const movements = [
        { from: 'new', to: 'working' },
        { from: 'working', to: 'qualified' },
        { from: 'qualified', to: 'not_interested' }  // Archive
    ];
    
    for (const move of movements) {
        console.log(`  Moving from ${move.from} to ${move.to}...`);
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/leads/${testLeadId}/move`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ to_status: move.to })
            });
            
            if (!response.ok) {
                console.error(`  ❌ Failed to move lead:`, await response.text());
                return false;
            }
            
            console.log(`  ✅ Successfully moved to ${move.to}`);
            
            // Small delay to simulate real usage
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`  ❌ Move error:`, error.message);
            return false;
        }
    }
    
    return true;
}

async function testLeadReactivation() {
    console.log('\n♻️ Testing lead reactivation...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/leads/${testLeadId}/reactivate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target_status: 'working' })
        });
        
        if (!response.ok) {
            console.error('❌ Failed to reactivate lead:', await response.text());
            return false;
        }
        
        console.log('✅ Successfully reactivated lead');
        return true;
    } catch (error) {
        console.error('❌ Reactivation error:', error.message);
        return false;
    }
}

async function getKanbanView() {
    console.log('\n📊 Getting Kanban view...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/kanban?studio_id=${TEST_STUDIO_ID}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            console.error('❌ Failed to get Kanban view:', await response.text());
            return false;
        }
        
        const data = await response.json();
        console.log('✅ Kanban view loaded successfully');
        console.log(`  Active leads: ${Object.values(data.active).flat().length}`);
        console.log(`  Archived leads: ${Object.values(data.archived.positive).flat().length + Object.values(data.archived.negative).flat().length}`);
        return true;
    } catch (error) {
        console.error('❌ Get Kanban error:', error.message);
        return false;
    }
}

async function cleanup() {
    if (testLeadId) {
        console.log('\n🧹 Cleaning up test lead...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/leads/${testLeadId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                console.log('✅ Test lead deleted');
            }
        } catch (error) {
            console.error('⚠️ Cleanup warning:', error.message);
        }
    }
}

async function runTests() {
    console.log('🚀 Starting Kanban Fix Tests\n');
    console.log('================================\n');
    
    // Note: You'll need to update these with valid credentials
    console.log('⚠️ NOTE: Update TEST_AUTH credentials before running!\n');
    
    if (!await login()) {
        console.log('\n❌ Tests aborted: Login failed');
        return;
    }
    
    if (!await createTestLead()) {
        console.log('\n❌ Tests aborted: Could not create test lead');
        return;
    }
    
    if (!await testLeadMovement()) {
        console.log('\n❌ Tests failed: Lead movement issues');
    }
    
    if (!await testLeadReactivation()) {
        console.log('\n❌ Tests failed: Lead reactivation issues');
    }
    
    if (!await getKanbanView()) {
        console.log('\n❌ Tests failed: Kanban view issues');
    }
    
    await cleanup();
    
    console.log('\n================================');
    console.log('✅ All tests completed!');
    console.log('\nTo test in the UI:');
    console.log('1. Open the Lead Kanban page');
    console.log('2. Try dragging leads between columns');
    console.log('3. Archive a lead using the quick actions');
    console.log('4. Show the archive panel and reactivate a lead');
    console.log('5. Verify the UI updates without needing a page refresh');
}

// Run the tests
runTests().catch(console.error);