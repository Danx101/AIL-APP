#!/usr/bin/env node

/**
 * Fix runtime errors in the application
 */

const db = require('./src/database/database-wrapper');

async function fixRuntimeErrors() {
  console.log('🔧 Fixing runtime errors...\n');
  
  try {
    // Fix 1: Ensure all appointments have proper person_type
    console.log('1️⃣ Fixing appointments without person_type...');
    
    const appointmentsWithoutType = await db.all(`
      SELECT * FROM appointments 
      WHERE person_type IS NULL
    `);
    
    if (appointmentsWithoutType.length > 0) {
      console.log(`   Found ${appointmentsWithoutType.length} appointments without person_type`);
      
      // Set default person_type based on what fields are populated
      await db.run(`
        UPDATE appointments 
        SET person_type = CASE
          WHEN lead_id IS NOT NULL THEN 'lead'
          WHEN customer_id IS NOT NULL THEN 'customer'
          WHEN customer_ref_id IS NOT NULL THEN 'customer'
          ELSE 'customer'
        END
        WHERE person_type IS NULL
      `);
      
      console.log('   ✅ Fixed person_type for all appointments');
    } else {
      console.log('   ✅ All appointments have person_type');
    }
    
    // Fix 2: Create test data if none exists
    console.log('\n2️⃣ Checking for test data...');
    
    const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
    
    if (customerCount.count === 0) {
      console.log('   No customers found - creating test customer...');
      
      const studios = await db.all('SELECT id FROM studios LIMIT 1');
      if (studios.length > 0) {
        const studioId = studios[0].id;
        
        await db.run(`
          INSERT INTO customers (
            studio_id, 
            contact_first_name, 
            contact_last_name, 
            contact_email, 
            contact_phone,
            registration_code,
            has_app_access,
            customer_since,
            acquisition_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `, [
          studioId,
          'Test',
          'Customer',
          'test@example.com',
          '+1234567890',
          'TEST' + Math.random().toString(36).substring(7).toUpperCase(),
          0,
          'direct'
        ]);
        
        console.log('   ✅ Created test customer');
        
        // Add active sessions for test customer
        const newCustomer = await db.get('SELECT id FROM customers ORDER BY id DESC LIMIT 1');
        
        if (newCustomer) {
          await db.run(`
            INSERT INTO customer_sessions (
              customer_id,
              studio_id,
              block_type,
              total_sessions,
              remaining_sessions,
              status,
              activation_date,
              purchase_date
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [newCustomer.id, studioId, 20, 20, 20, 'active']);
          
          console.log('   ✅ Added active session block for test customer');
        }
      }
    } else {
      console.log(`   ✅ Found ${customerCount.count} customers`);
    }
    
    // Fix 3: Clear stuck pending blocks that shouldn't exist
    console.log('\n3️⃣ Checking for stuck pending blocks...');
    
    // Find customers with pending blocks but no active blocks
    const stuckPendingBlocks = await db.all(`
      SELECT 
        cs.*,
        c.contact_first_name,
        c.contact_last_name,
        (SELECT COUNT(*) FROM customer_sessions cs2 
         WHERE cs2.customer_id = cs.customer_id 
         AND cs2.status = 'active') as active_count
      FROM customer_sessions cs
      JOIN customers c ON cs.customer_id = c.id
      WHERE cs.status = 'pending'
      HAVING active_count = 0
    `);
    
    if (stuckPendingBlocks.length > 0) {
      console.log(`   Found ${stuckPendingBlocks.length} stuck pending blocks (no active block)`);
      
      for (const block of stuckPendingBlocks) {
        console.log(`   Activating pending block for ${block.contact_first_name} ${block.contact_last_name}`);
        
        await db.run(`
          UPDATE customer_sessions 
          SET status = 'active', 
              activation_date = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [block.id]);
      }
      
      console.log('   ✅ Fixed stuck pending blocks');
    } else {
      console.log('   ✅ No stuck pending blocks found');
    }
    
    // Fix 4: Ensure appointment types exist
    console.log('\n4️⃣ Checking appointment types...');
    
    const appointmentTypes = await db.all('SELECT * FROM appointment_types WHERE is_active = 1');
    
    if (appointmentTypes.length === 0) {
      console.log('   No appointment types found - creating defaults...');
      
      const studios = await db.all('SELECT id FROM studios');
      
      for (const studio of studios) {
        // Create standard appointment type
        await db.run(`
          INSERT INTO appointment_types (
            studio_id, name, duration_minutes, consumes_session, 
            is_probebehandlung, description, color, is_active
          ) VALUES 
          (?, 'Behandlung', 60, 1, 0, 'Standard treatment session', '#28a745', 1),
          (?, 'Probebehandlung', 60, 0, 1, 'Trial treatment for new customers', '#ffc107', 1)
        `, [studio.id, studio.id]);
      }
      
      console.log('   ✅ Created default appointment types');
    } else {
      console.log(`   ✅ Found ${appointmentTypes.length} appointment types`);
    }
    
    // Fix 5: Final validation
    console.log('\n5️⃣ Final validation...');
    
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM customer_sessions WHERE status = 'active') as active_blocks,
        (SELECT COUNT(*) FROM customer_sessions WHERE status = 'pending') as pending_blocks,
        (SELECT COUNT(*) FROM appointment_types WHERE is_active = 1) as appointment_types,
        (SELECT COUNT(*) FROM appointments) as appointments
    `);
    
    console.log('\n📊 System Status After Fixes:');
    console.table(stats);
    
    if (stats.customers > 0 && stats.appointment_types > 0) {
      console.log('\n✅ System should now be functional!');
      console.log('\n📋 Next Steps:');
      console.log('1. Refresh the frontend application');
      console.log('2. Try adding sessions to a customer without pending blocks');
      console.log('3. Try creating an appointment');
    } else {
      console.log('\n⚠️  Some issues remain - manual intervention may be needed');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
  
  process.exit(0);
}

fixRuntimeErrors();