#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateRemainingData() {
  console.log('🚀 Migrating remaining data to MySQL...\n');

  // SQLite connection
  const sqliteDbPath = path.join(__dirname, '../database.sqlite');
  const sqlite = new sqlite3.Database(sqliteDbPath);

  // MySQL connection
  const mysqlConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'hopper.proxy.rlwy.net',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 34671,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'bbr1hm1gPbZdyKSrAeRepjooYRiSayER',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    ssl: { rejectUnauthorized: false }
  };

  const connection = await mysql.createConnection(mysqlConfig);

  try {
    await connection.beginTransaction();

    // 1. Migrate appointment_types
    console.log('📋 Migrating appointment types...');
    
    // First, delete existing MySQL appointment types for studio 3 to avoid duplicates
    await connection.execute('DELETE FROM appointment_types WHERE studio_id = 3');
    
    // Get appointment types from SQLite
    const appointmentTypes = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointment_types WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const type of appointmentTypes) {
      // Map studio_id 1 to 3
      const studioId = type.studio_id === 1 ? 3 : type.studio_id;
      
      await connection.execute(
        `INSERT INTO appointment_types (name, duration_minutes, session_credits, studio_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          type.name,
          type.duration_minutes || 60, // Default to 60 minutes if undefined
          type.session_credits || 1,    // Default to 1 credit if undefined
          studioId,
          type.created_at || new Date().toISOString(),
          type.updated_at || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✅ Migrated ${appointmentTypes.length} appointment types`);

    // 2. Migrate appointments
    console.log('\n📋 Migrating appointments...');
    
    // Delete existing appointments for studio 3
    await connection.execute('DELETE FROM appointments WHERE studio_id = 3');
    
    const appointments = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointments WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const appt of appointments) {
      // Map studio_id 1 to 3
      const studioId = appt.studio_id === 1 ? 3 : appt.studio_id;
      
      // Convert time format if needed (add :00 for seconds if missing)
      let appointmentTime = appt.appointment_time;
      if (appointmentTime && !appointmentTime.includes(':00:00')) {
        appointmentTime = appointmentTime + ':00';
      }
      
      // Convert date format for MySQL
      const appointmentDate = appt.appointment_date ? appt.appointment_date.split('T')[0] : null;
      
      await connection.execute(
        `INSERT INTO appointments (customer_id, studio_id, appointment_date, appointment_time, 
         appointment_type_id, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appt.customer_id,
          studioId,
          appointmentDate,
          appointmentTime,
          appt.appointment_type_id || 1, // Default to 1 if not set
          appt.status || 'pending',
          appt.notes || '',
          appt.created_at || new Date().toISOString(),
          appt.updated_at || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✅ Migrated ${appointments.length} appointments`);

    // 3. Migrate leads
    console.log('\n📋 Migrating leads...');
    
    // Delete existing leads for studio 3
    await connection.execute('DELETE FROM leads WHERE studio_id = 3');
    
    const leads = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM leads WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const lead of leads) {
      // Map studio_id 1 to 3
      const studioId = lead.studio_id === 1 ? 3 : lead.studio_id;
      
      await connection.execute(
        `INSERT INTO leads (studio_id, first_name, last_name, email, phone_number, 
         status, source, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studioId,
          lead.first_name || '',
          lead.last_name || '',
          lead.email,
          lead.phone_number || lead.phone || '',
          lead.status || 'new',
          lead.source || 'direct',
          lead.notes || '',
          lead.created_at || new Date().toISOString(),
          lead.updated_at || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✅ Migrated ${leads.length} leads`);

    // 4. Create default appointment types if none exist
    const [typeCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM appointment_types WHERE studio_id = 3'
    );
    
    if (typeCheck[0].count === 0) {
      console.log('\n📋 Creating default appointment types...');
      const defaultTypes = [
        { name: 'Erstbehandlung', duration_minutes: 90, session_credits: 1 },
        { name: 'Folgebehandlung', duration_minutes: 60, session_credits: 1 },
        { name: 'Beratungsgespräch', duration_minutes: 30, session_credits: 0 }
      ];
      
      for (const type of defaultTypes) {
        await connection.execute(
          `INSERT INTO appointment_types (name, duration_minutes, session_credits, studio_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [type.name, type.duration_minutes, type.session_credits, 3]
        );
      }
      console.log('  ✅ Created default appointment types');
    }

    await connection.commit();
    console.log('\n✅ All data migrated successfully!');

    // Show final counts
    const [finalTypes] = await connection.execute('SELECT COUNT(*) as count FROM appointment_types WHERE studio_id = 3');
    const [finalAppts] = await connection.execute('SELECT COUNT(*) as count FROM appointments WHERE studio_id = 3');
    const [finalLeads] = await connection.execute('SELECT COUNT(*) as count FROM leads WHERE studio_id = 3');
    
    console.log('\n📊 Final counts:');
    console.log(`  - Appointment types: ${finalTypes[0].count}`);
    console.log(`  - Appointments: ${finalAppts[0].count}`);
    console.log(`  - Leads: ${finalLeads[0].count}`);

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error:', error);
  } finally {
    sqlite.close();
    await connection.end();
  }
}

migrateRemainingData();