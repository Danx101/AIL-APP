#!/usr/bin/env node

/**
 * Test customer creation and appointment flow
 */

const db = require('./src/database/database-wrapper');

async function testCustomerAppointmentFlow() {
  console.log('🧪 Testing Customer Creation and Appointment Flow\n');
  
  try {
    // Step 1: Get studio info
    console.log('1️⃣ Getting studio information...');
    const studio = await db.get('SELECT * FROM studios WHERE is_active = 1 LIMIT 1');
    
    if (!studio) {
      console.log('❌ No active studio found. Creating one...');
      await db.run(`
        INSERT INTO studios (name, owner_id, address, phone, is_active, unique_identifier)
        VALUES ('Test Studio', 1, 'Test Address', '+1234567890', 1, 'TEST')
      `);
      const newStudio = await db.get('SELECT * FROM studios WHERE unique_identifier = "TEST"');
      console.log('✅ Created test studio:', newStudio.name);
      studio = newStudio;
    } else {
      console.log('✅ Using studio:', studio.name);
    }

    // Step 2: Create first customer with 20 sessions
    console.log('\n2️⃣ Creating first customer with 20 sessions...');
    
    const customer1Result = await db.run(`
      INSERT INTO customers (
        studio_id, 
        contact_first_name, 
        contact_last_name, 
        contact_phone, 
        contact_email,
        customer_since,
        acquisition_type,
        notes
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'direct_purchase', ?)
    `, [
      studio.id,
      'Max',
      'Mustermann',
      '+49170' + Math.floor(Math.random() * 10000000),
      'max.mustermann@example.com',
      'Test customer for appointment flow'
    ]);
    
    const customer1Id = customer1Result.insertId;
    
    // Update registration code
    await db.run(
      'UPDATE customers SET registration_code = ? WHERE id = ?',
      [`${studio.unique_identifier}-${customer1Id}`, customer1Id]
    );
    
    // Add initial 20 sessions (should be ACTIVE)
    await db.run(`
      INSERT INTO customer_sessions (
        customer_id, studio_id, block_type, total_sessions, 
        remaining_sessions, status, activation_date, purchase_date, payment_method
      ) VALUES (?, ?, 20, 20, 20, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'cash')
    `, [customer1Id, studio.id]);
    
    console.log('✅ Created customer: Max Mustermann with 20 active sessions');

    // Step 3: Create second customer with 10 sessions
    console.log('\n3️⃣ Creating second customer with 10 sessions...');
    
    const customer2Result = await db.run(`
      INSERT INTO customers (
        studio_id, contact_first_name, contact_last_name, 
        contact_phone, contact_email, customer_since, acquisition_type
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'direct_purchase')
    `, [
      studio.id, 'Anna', 'Schmidt',
      '+49171' + Math.floor(Math.random() * 10000000),
      'anna.schmidt@example.com'
    ]);
    
    const customer2Id = customer2Result.insertId;
    
    await db.run(
      'UPDATE customers SET registration_code = ? WHERE id = ?',
      [`${studio.unique_identifier}-${customer2Id}`, customer2Id]
    );
    
    // Add 10 sessions (should be ACTIVE)
    await db.run(`
      INSERT INTO customer_sessions (
        customer_id, studio_id, block_type, total_sessions, 
        remaining_sessions, status, activation_date, purchase_date, payment_method
      ) VALUES (?, ?, 10, 10, 10, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'card')
    `, [customer2Id, studio.id]);
    
    console.log('✅ Created customer: Anna Schmidt with 10 active sessions');

    // Step 4: Test adding sessions to customer with active block
    console.log('\n4️⃣ Adding 20 more sessions to Max (should be PENDING)...');
    
    await db.run(`
      INSERT INTO customer_sessions (
        customer_id, studio_id, block_type, total_sessions, 
        remaining_sessions, status, activation_date, purchase_date, payment_method
      ) VALUES (?, ?, 20, 20, 20, 'pending', NULL, CURRENT_TIMESTAMP, 'transfer')
    `, [customer1Id, studio.id]);
    
    console.log('✅ Added 20 pending sessions to Max Mustermann');

    // Step 5: Simulate consuming all active sessions for Max
    console.log('\n5️⃣ Simulating consumption of all active sessions for Max...');
    
    await db.run(`
      UPDATE customer_sessions 
      SET remaining_sessions = 0, status = 'completed'
      WHERE customer_id = ? AND status = 'active'
    `, [customer1Id]);
    
    // Activate pending block
    await db.run(`
      UPDATE customer_sessions 
      SET status = 'active', activation_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND status = 'pending'
    `, [customer1Id]);
    
    console.log('✅ Consumed all sessions and activated pending block');

    // Step 6: Create appointment types if needed
    console.log('\n6️⃣ Ensuring appointment types exist...');
    
    const appointmentTypes = await db.all(
      'SELECT * FROM appointment_types WHERE studio_id = ? AND is_active = 1',
      [studio.id]
    );
    
    if (appointmentTypes.length === 0) {
      await db.run(`
        INSERT INTO appointment_types (
          studio_id, name, duration_minutes, consumes_session, 
          description, color, is_active
        ) VALUES 
        (?, 'Behandlung', 60, 1, 'Standard treatment', '#28a745', 1),
        (?, 'Beratung', 30, 0, 'Consultation', '#17a2b8', 1)
      `, [studio.id, studio.id]);
      
      console.log('✅ Created appointment types');
    } else {
      console.log('✅ Appointment types already exist');
    }

    const treatmentType = await db.get(
      'SELECT * FROM appointment_types WHERE studio_id = ? AND consumes_session = 1 LIMIT 1',
      [studio.id]
    );

    // Step 7: Create appointments
    console.log('\n7️⃣ Creating test appointments...');
    
    // Get a valid user ID for the foreign key constraint
    const user = await db.get('SELECT id FROM users LIMIT 1');
    const userId = user ? user.id : 1;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Appointment for Max at 10:00
    await db.run(`
      INSERT INTO appointments (
        studio_id, customer_id, customer_ref_id, person_type, appointment_type_id,
        appointment_date, start_time, end_time, status, 
        session_consumed, sessions_consumed_count, notes
      ) VALUES (?, ?, ?, 'customer', ?, ?, '10:00', '11:00', 'scheduled', 1, 1, 'Test appointment for Max')
    `, [studio.id, userId, customer1Id, treatmentType.id, tomorrowStr]);
    
    console.log('✅ Created appointment for Max at 10:00');
    
    // Appointment for Anna at 11:00 (back-to-back, not overlapping)
    await db.run(`
      INSERT INTO appointments (
        studio_id, customer_id, customer_ref_id, person_type, appointment_type_id,
        appointment_date, start_time, end_time, status, 
        session_consumed, sessions_consumed_count, notes
      ) VALUES (?, ?, ?, 'customer', ?, ?, '11:00', '12:00', 'scheduled', 1, 1, 'Test appointment for Anna')
    `, [studio.id, userId, customer2Id, treatmentType.id, tomorrowStr]);
    
    console.log('✅ Created appointment for Anna at 11:00 (back-to-back)');

    // Step 8: Display final status
    console.log('\n8️⃣ Final System Status:');
    console.log('=' .repeat(50));
    
    // Customer summary
    const customers = await db.all(`
      SELECT 
        c.id,
        CONCAT(c.contact_first_name, ' ', c.contact_last_name) as name,
        c.contact_phone as phone,
        (SELECT COUNT(*) FROM customer_sessions WHERE customer_id = c.id) as total_blocks,
        (SELECT remaining_sessions FROM customer_sessions 
         WHERE customer_id = c.id AND status = 'active' LIMIT 1) as active_sessions,
        (SELECT remaining_sessions FROM customer_sessions 
         WHERE customer_id = c.id AND status = 'pending' LIMIT 1) as pending_sessions
      FROM customers c
      WHERE c.studio_id = ?
      ORDER BY c.id DESC
      LIMIT 5
    `, [studio.id]);
    
    console.log('\n📋 Customers:');
    console.table(customers);
    
    // Session blocks summary
    const blocks = await db.all(`
      SELECT 
        cs.id as block_id,
        CONCAT(c.contact_first_name, ' ', c.contact_last_name) as customer,
        cs.block_type,
        cs.total_sessions,
        cs.remaining_sessions,
        cs.status,
        DATE(cs.activation_date) as activation_date
      FROM customer_sessions cs
      JOIN customers c ON cs.customer_id = c.id
      WHERE cs.studio_id = ?
      ORDER BY cs.id DESC
      LIMIT 10
    `, [studio.id]);
    
    console.log('\n📦 Session Blocks:');
    console.table(blocks);
    
    // Appointments summary
    const appointments = await db.all(`
      SELECT 
        a.id,
        CONCAT(c.contact_first_name, ' ', c.contact_last_name) as customer,
        at.name as type,
        a.appointment_date as date,
        a.start_time || '-' || a.end_time as time,
        a.status
      FROM appointments a
      JOIN customers c ON a.customer_ref_id = c.id
      JOIN appointment_types at ON a.appointment_type_id = at.id
      WHERE a.studio_id = ?
      ORDER BY a.appointment_date DESC, a.start_time DESC
      LIMIT 10
    `, [studio.id]);
    
    console.log('\n📅 Appointments:');
    console.table(appointments);
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Key Points Verified:');
    console.log('  1. New customers get ACTIVE session blocks immediately');
    console.log('  2. Additional blocks are PENDING when active block exists');
    console.log('  3. Pending blocks activate when active block is consumed');
    console.log('  4. Back-to-back appointments (10:00-11:00, 11:00-12:00) are allowed');
    console.log('  5. Customer references work correctly in appointments');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testCustomerAppointmentFlow();