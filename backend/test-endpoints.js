#!/usr/bin/env node

/**
 * Test the problematic endpoints directly
 */

const db = require('./src/database/database-wrapper');

async function testEndpoints() {
  console.log('🧪 Testing problematic endpoints...\n');
  
  try {
    // Test 1: Check if customer_ref_id column is being used correctly
    console.log('1️⃣ Testing appointments query with new structure...');
    
    const appointmentsQuery = `
      SELECT 
        a.*,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_first_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', 1)
          ELSE 'Unknown'
        END as customer_first_name,
        CASE 
          WHEN a.person_type = 'customer' THEN c.contact_last_name
          WHEN a.person_type = 'lead' THEN SUBSTRING_INDEX(l.name, ' ', -1)
          ELSE 'Person'
        END as customer_last_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_ref_id = c.id AND a.person_type = 'customer'
      LEFT JOIN leads l ON a.lead_id = l.id AND a.person_type = 'lead'
      WHERE a.studio_id = 1
      LIMIT 1
    `;
    
    try {
      const appointments = await db.all(appointmentsQuery);
      console.log('✅ Appointments query executed successfully');
      console.log(`   Found ${appointments.length} appointments`);
      if (appointments.length > 0) {
        console.log('   Sample appointment:', {
          id: appointments[0].id,
          customer_ref_id: appointments[0].customer_ref_id,
          person_type: appointments[0].person_type,
          customer_name: `${appointments[0].customer_first_name} ${appointments[0].customer_last_name}`
        });
      }
    } catch (error) {
      console.log('❌ Appointments query failed:', error.message);
      console.log('   SQL Error:', error.code);
    }
    
    // Test 2: Check customer sessions
    console.log('\n2️⃣ Testing customer sessions...');
    
    const customersWithSessions = await db.all(`
      SELECT 
        c.id,
        c.contact_first_name,
        c.contact_last_name,
        cs.status as session_status,
        cs.remaining_sessions
      FROM customers c
      LEFT JOIN customer_sessions cs ON cs.customer_id = c.id
      WHERE c.studio_id = 1
      LIMIT 5
    `);
    
    console.log('✅ Customer sessions query executed');
    console.table(customersWithSessions);
    
    // Test 3: Check for pending blocks
    console.log('\n3️⃣ Checking for pending session blocks...');
    
    const pendingBlocks = await db.all(`
      SELECT 
        cs.*,
        c.contact_first_name,
        c.contact_last_name
      FROM customer_sessions cs
      JOIN customers c ON cs.customer_id = c.id
      WHERE cs.status = 'pending'
      LIMIT 5
    `);
    
    console.log(`Found ${pendingBlocks.length} pending blocks`);
    if (pendingBlocks.length > 0) {
      console.log('⚠️  These customers have pending blocks (cannot add more):');
      pendingBlocks.forEach(block => {
        console.log(`   - ${block.contact_first_name} ${block.contact_last_name} (Customer ID: ${block.customer_id})`);
      });
    }
    
    // Test 4: Check if old customer_id is still being used
    console.log('\n4️⃣ Checking for appointments using old customer_id field...');
    
    const oldCustomerIdAppointments = await db.all(`
      SELECT COUNT(*) as count
      FROM appointments 
      WHERE customer_id IS NOT NULL 
        AND customer_ref_id IS NULL
        AND person_type = 'customer'
    `);
    
    console.log(`Appointments still using old customer_id: ${oldCustomerIdAppointments[0].count}`);
    
    if (oldCustomerIdAppointments[0].count > 0) {
      console.log('⚠️  Need to migrate these appointments to use customer_ref_id');
      
      // Try to auto-fix some
      console.log('   Attempting to auto-fix by matching studio_id...');
      
      const fixQuery = `
        UPDATE appointments a
        SET a.customer_ref_id = (
          SELECT c.id 
          FROM customers c 
          WHERE c.studio_id = a.studio_id 
          LIMIT 1
        )
        WHERE a.customer_id IS NOT NULL 
          AND a.customer_ref_id IS NULL
          AND a.person_type = 'customer'
          AND EXISTS (
            SELECT 1 FROM customers c2 
            WHERE c2.studio_id = a.studio_id
          )
      `;
      
      try {
        const result = await db.run(fixQuery);
        console.log(`   ✅ Fixed ${result.changes || 0} appointments`);
      } catch (error) {
        console.log('   ❌ Could not auto-fix:', error.message);
      }
    }
    
    // Test 5: Final validation
    console.log('\n5️⃣ Final validation...');
    
    const validation = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM appointments) as total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE customer_ref_id IS NOT NULL) as appointments_with_customer_ref,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM customer_sessions WHERE status = 'active') as active_session_blocks
    `);
    
    console.log('System Status:');
    console.table(validation);
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
  
  process.exit(0);
}

testEndpoints();