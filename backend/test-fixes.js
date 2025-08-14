#!/usr/bin/env node

/**
 * Test the fixes for session blocks and appointments
 */

const db = require('./src/database/database-wrapper');

async function testFixes() {
  console.log('🧪 Testing session block and appointment fixes\n');
  
  try {
    // Test 1: Get a customer with active sessions
    console.log('1️⃣ Testing customer with active sessions...');
    
    const customers = await db.all(`
      SELECT c.id, c.contact_first_name, c.contact_last_name
      FROM customers c
      JOIN customer_sessions cs ON cs.customer_id = c.id
      WHERE cs.status = 'active' AND cs.remaining_sessions > 0
      LIMIT 3
    `);
    
    if (customers.length === 0) {
      console.log('❌ No customers with active sessions found');
      return;
    }
    
    console.log(`✅ Found ${customers.length} customers with active sessions`);
    
    for (const customer of customers) {
      console.log(`\n👤 Testing customer: ${customer.contact_first_name} ${customer.contact_last_name} (ID: ${customer.id})`);
      
      // Test session blocks endpoint
      const blocks = await db.all(`
        SELECT * FROM customer_sessions 
        WHERE customer_id = ? 
        ORDER BY 
          CASE status 
            WHEN 'active' THEN 1 
            WHEN 'pending' THEN 2 
            ELSE 3 
          END, 
          created_at DESC
      `, [customer.id]);
      
      console.log(`   📦 Session Blocks: ${blocks.length}`);
      blocks.forEach(block => {
        console.log(`     - ${block.status.toUpperCase()}: ${block.remaining_sessions}/${block.total_sessions} sessions`);
      });
      
      // Test appointments for this customer
      const appointments = await db.all(`
        SELECT 
          a.*,
          at.name as appointment_type_name
        FROM appointments a
        LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
        WHERE a.customer_ref_id = ? AND a.person_type = 'customer'
        ORDER BY a.appointment_date DESC
      `, [customer.id]);
      
      console.log(`   📅 Appointments: ${appointments.length}`);
      appointments.forEach(apt => {
        console.log(`     - ${apt.appointment_date} ${apt.start_time}-${apt.end_time} (${apt.appointment_type_name || 'Unknown Type'})`);
      });
    }
    
    // Test 2: Verify the 404 customer issues
    console.log('\n2️⃣ Testing potentially problematic customer IDs...');
    
    const testIds = [32, 34];
    for (const customerId of testIds) {
      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (customer) {
        console.log(`✅ Customer ID ${customerId}: ${customer.contact_first_name} ${customer.contact_last_name} exists`);
        
        // Check session blocks
        const blocks = await db.all('SELECT * FROM customer_sessions WHERE customer_id = ?', [customerId]);
        console.log(`   Has ${blocks.length} session blocks`);
        
        // Check appointments
        const appointments = await db.all('SELECT * FROM appointments WHERE customer_ref_id = ? AND person_type = "customer"', [customerId]);
        console.log(`   Has ${appointments.length} appointments`);
      } else {
        console.log(`❌ Customer ID ${customerId} does not exist`);
      }
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testFixes();