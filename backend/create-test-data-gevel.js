#!/usr/bin/env node

/**
 * Create test data for gevelvie@gmail.com user
 */

const db = require('./src/database/database-wrapper');
const bcrypt = require('bcryptjs');

async function createTestDataForGevel() {
  console.log('🔧 Creating test data for gevelvie@gmail.com\n');
  
  try {
    // Step 1: Find or update the user
    console.log('1️⃣ Finding user gevelvie@gmail.com...');
    
    let user = await db.get('SELECT * FROM users WHERE email = ?', ['gevelvie@gmail.com']);
    
    if (!user) {
      console.log('   User not found, creating...');
      const hashedPassword = await bcrypt.hash('12345678Aa', 10);
      
      const result = await db.run(`
        INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
        VALUES (?, ?, 'studio_owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, ['gevelvie@gmail.com', hashedPassword]);
      
      user = await db.get('SELECT * FROM users WHERE id = ?', [result.insertId]);
      console.log('✅ Created user:', user.email);
    } else {
      // Update password if needed
      console.log('✅ Found existing user:', user.email);
      const hashedPassword = await bcrypt.hash('12345678Aa', 10);
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);
      console.log('✅ Updated password to: 12345678Aa');
    }

    // Step 2: Find or create studio
    console.log('\n2️⃣ Setting up studio...');
    
    let studio = await db.get('SELECT * FROM studios WHERE owner_id = ?', [user.id]);
    
    if (!studio) {
      console.log('   Creating new studio...');
      const result = await db.run(`
        INSERT INTO studios (
          name, owner_id, address, phone, email, 
          is_active, unique_identifier, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        'Gevel Fitness Studio',
        user.id,
        'Hauptstraße 123, 10115 Berlin',
        '+49 30 12345678',
        'studio@gevel-fitness.de',
        'GEVEL'
      ]);
      
      studio = await db.get('SELECT * FROM studios WHERE id = ?', [result.insertId]);
      console.log('✅ Created studio:', studio.name);
    } else {
      console.log('✅ Found existing studio:', studio.name);
    }

    // Step 3: Create appointment types
    console.log('\n3️⃣ Setting up appointment types...');
    
    const existingTypes = await db.all(
      'SELECT * FROM appointment_types WHERE studio_id = ?', 
      [studio.id]
    );
    
    if (existingTypes.length === 0) {
      await db.run(`
        INSERT INTO appointment_types (
          studio_id, name, duration_minutes, consumes_session, 
          description, color, is_active
        ) VALUES 
        (?, 'Abnehmen Behandlung', 60, 1, 'Standard weight loss treatment', '#28a745', 1),
        (?, 'Probebehandlung', 60, 0, 'Free trial treatment', '#ffc107', 1),
        (?, 'Beratungsgespräch', 30, 0, 'Consultation', '#17a2b8', 1),
        (?, 'Nachkontrolle', 30, 0, 'Follow-up check', '#6c757d', 1)
      `, [studio.id, studio.id, studio.id, studio.id]);
      
      console.log('✅ Created 4 appointment types');
    } else {
      console.log('✅ Appointment types already exist');
    }

    // Step 4: Create test customers
    console.log('\n4️⃣ Creating test customers...');
    
    const testCustomers = [
      { first: 'Thomas', last: 'Müller', phone: '+49 151 11111111', email: 'thomas.mueller@test.de', sessions: 20 },
      { first: 'Sarah', last: 'Weber', phone: '+49 151 22222222', email: 'sarah.weber@test.de', sessions: 40 },
      { first: 'Michael', last: 'Schmidt', phone: '+49 151 33333333', email: 'michael.schmidt@test.de', sessions: 10 },
      { first: 'Lisa', last: 'Wagner', phone: '+49 151 44444444', email: 'lisa.wagner@test.de', sessions: 30 },
      { first: 'Daniel', last: 'Becker', phone: '+49 151 55555555', email: 'daniel.becker@test.de', sessions: 20 }
    ];

    const customerIds = [];
    
    for (const customer of testCustomers) {
      // Check if customer exists
      const existing = await db.get(
        'SELECT * FROM customers WHERE studio_id = ? AND contact_email = ?',
        [studio.id, customer.email]
      );
      
      if (!existing) {
        // Create customer
        const result = await db.run(`
          INSERT INTO customers (
            studio_id, contact_first_name, contact_last_name, 
            contact_phone, contact_email, customer_since, 
            acquisition_type, notes
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'direct_purchase', ?)
        `, [
          studio.id, customer.first, customer.last,
          customer.phone, customer.email,
          `Test customer with ${customer.sessions} sessions`
        ]);
        
        const customerId = result.insertId;
        customerIds.push(customerId);
        
        // Update registration code
        await db.run(
          'UPDATE customers SET registration_code = ? WHERE id = ?',
          [`${studio.unique_identifier}-${customerId}`, customerId]
        );
        
        // Add active session block
        await db.run(`
          INSERT INTO customer_sessions (
            customer_id, studio_id, block_type, total_sessions, 
            remaining_sessions, status, activation_date, purchase_date, payment_method
          ) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'card')
        `, [customerId, studio.id, customer.sessions, customer.sessions, customer.sessions - 2]); // Used 2 sessions
        
        console.log(`✅ Created customer: ${customer.first} ${customer.last} (${customer.sessions - 2}/${customer.sessions} sessions remaining)`);
      } else {
        customerIds.push(existing.id);
        console.log(`   Customer ${customer.first} ${customer.last} already exists`);
      }
    }

    // Step 5: Create test appointments
    console.log('\n5️⃣ Creating test appointments...');
    
    const treatmentType = await db.get(
      'SELECT * FROM appointment_types WHERE studio_id = ? AND consumes_session = 1 LIMIT 1',
      [studio.id]
    );
    
    if (treatmentType && customerIds.length > 0) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      
      const appointments = [
        { customerId: customerIds[0], date: today, time: '14:00', duration: 60 },
        { customerId: customerIds[1], date: today, time: '15:00', duration: 60 },
        { customerId: customerIds[2], date: tomorrow, time: '09:00', duration: 60 },
        { customerId: customerIds[3], date: tomorrow, time: '10:00', duration: 60 },
        { customerId: customerIds[4], date: tomorrow, time: '11:00', duration: 60 },
        { customerId: customerIds[0], date: dayAfter, time: '16:00', duration: 60 },
        { customerId: customerIds[1], date: dayAfter, time: '17:00', duration: 60 }
      ];
      
      for (const apt of appointments) {
        if (apt.customerId) {
          const dateStr = apt.date.toISOString().split('T')[0];
          const endTime = `${parseInt(apt.time.split(':')[0]) + 1}:00`;
          
          // Check if appointment already exists
          const existing = await db.get(
            'SELECT * FROM appointments WHERE studio_id = ? AND customer_ref_id = ? AND appointment_date = ? AND start_time = ?',
            [studio.id, apt.customerId, dateStr, apt.time + ':00']
          );
          
          if (!existing) {
            await db.run(`
              INSERT INTO appointments (
                studio_id, customer_id, customer_ref_id, person_type, 
                appointment_type_id, appointment_date, start_time, end_time, 
                status, session_consumed, sessions_consumed_count, notes
              ) VALUES (?, ?, ?, 'customer', ?, ?, ?, ?, 'scheduled', 1, 1, 'Test appointment')
            `, [studio.id, user.id, apt.customerId, treatmentType.id, dateStr, apt.time + ':00', endTime + ':00']);
            
            const customer = await db.get('SELECT contact_first_name, contact_last_name FROM customers WHERE id = ?', [apt.customerId]);
            console.log(`✅ Created appointment: ${customer.contact_first_name} ${customer.contact_last_name} on ${dateStr} at ${apt.time}`);
          }
        }
      }
    }

    // Step 6: Create test leads
    console.log('\n6️⃣ Creating test leads...');
    
    const testLeads = [
      { name: 'Julia Fischer', phone: '+49 151 66666666', email: 'julia.f@test.de', status: 'new' },
      { name: 'Mark Johnson', phone: '+49 151 77777777', email: 'mark.j@test.de', status: 'working' },
      { name: 'Emma Davis', phone: '+49 151 88888888', email: 'emma.d@test.de', status: 'qualified' }
    ];
    
    for (const lead of testLeads) {
      const existing = await db.get(
        'SELECT * FROM leads WHERE studio_id = ? AND email = ?',
        [studio.id, lead.email]
      );
      
      if (!existing) {
        await db.run(`
          INSERT INTO leads (
            studio_id, name, phone_number, email, status, 
            source, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'website', 'Test lead', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [studio.id, lead.name, lead.phone, lead.email, lead.status]);
        
        console.log(`✅ Created lead: ${lead.name} (${lead.status})`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Data Summary for gevelvie@gmail.com:');
    console.log('='.repeat(50));
    
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM customers WHERE studio_id = ?) as total_customers,
        (SELECT COUNT(*) FROM appointments WHERE studio_id = ? AND appointment_date >= DATE('now')) as upcoming_appointments,
        (SELECT COUNT(*) FROM leads WHERE studio_id = ?) as total_leads,
        (SELECT SUM(remaining_sessions) FROM customer_sessions cs 
         JOIN customers c ON cs.customer_id = c.id 
         WHERE c.studio_id = ? AND cs.status = 'active') as total_active_sessions
    `, [studio.id, studio.id, studio.id, studio.id]);
    
    console.log(`
📧 Login Credentials:
   Email: gevelvie@gmail.com
   Password: 12345678Aa

🏢 Studio: ${studio.name}
   ID: ${studio.id}
   Code: ${studio.unique_identifier}

👥 Customers: ${stats.total_customers}
📅 Upcoming Appointments: ${stats.upcoming_appointments}
🎯 Leads: ${stats.total_leads}
💳 Total Active Sessions: ${stats.total_active_sessions || 0}
    `);
    
    console.log('✅ Test data creation complete!');
    console.log('\n💡 You can now log in and test the system with real data.');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
  
  process.exit(0);
}

createTestDataForGevel();