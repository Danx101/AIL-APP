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

  // MySQL connection using environment variables
  const mysqlConfig = {
    host: process.env.MYSQLHOST || 'hopper.proxy.rlwy.net',
    port: process.env.MYSQLPORT || 34671,
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || 'bbr1hm1gPbZdyKSrAeRepjooYRiSayER',
    database: process.env.MYSQLDATABASE || 'railway',
    ssl: { rejectUnauthorized: false }
  };

  const connection = await mysql.createConnection(mysqlConfig);

  try {
    await connection.beginTransaction();

    // 1. Migrate appointment_types (with correct column names)
    console.log('📋 Migrating appointment types...');
    
    // First, check existing appointment types
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM appointment_types WHERE studio_id = 3');
    console.log(`  Existing appointment types: ${existing[0].count}`);
    
    // Get appointment types from SQLite
    const appointmentTypes = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointment_types WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    console.log(`  Found ${appointmentTypes.length} appointment types in SQLite`);

    // If we already have appointment types, skip
    if (existing[0].count > 0) {
      console.log('  ✅ Appointment types already exist, skipping...');
    } else if (appointmentTypes.length === 0) {
      // Create default appointment types
      console.log('  📝 Creating default appointment types...');
      const defaultTypes = [
        { name: 'Erstbehandlung', duration: 90, description: 'Erste Behandlung für neue Kunden' },
        { name: 'Folgebehandlung', duration: 60, description: 'Reguläre Folgebehandlung' },
        { name: 'Beratungsgespräch', duration: 30, description: 'Kostenloses Beratungsgespräch' }
      ];
      
      for (const type of defaultTypes) {
        await connection.execute(
          `INSERT INTO appointment_types (name, duration, description, studio_id, created_at, updated_at)
           VALUES (?, ?, ?, 3, NOW(), NOW())`,
          [type.name, type.duration, type.description]
        );
      }
      console.log('  ✅ Created default appointment types');
    } else {
      // Migrate from SQLite
      for (const type of appointmentTypes) {
        // Map studio_id 1 to 3
        const studioId = type.studio_id === 1 ? 3 : type.studio_id;
        
        await connection.execute(
          `INSERT INTO appointment_types (name, duration, description, studio_id, color, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            type.name,
            type.duration || 60,
            type.description || '',
            studioId,
            type.color || '#007bff',
            type.is_active !== 0 ? 1 : 0,
            type.created_at || new Date().toISOString(),
            type.updated_at || new Date().toISOString()
          ]
        );
      }
      console.log(`  ✅ Migrated ${appointmentTypes.length} appointment types`);
    }

    // 2. Migrate appointments
    console.log('\n📋 Migrating appointments...');
    
    const appointments = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointments WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    console.log(`  Found ${appointments.length} appointments in SQLite`);

    let migratedAppointments = 0;
    for (const appt of appointments) {
      try {
        // Map studio_id 1 to 3
        const studioId = appt.studio_id === 1 ? 3 : appt.studio_id;
        
        // Convert time format if needed (add :00 for seconds if missing)
        let appointmentTime = appt.appointment_time;
        if (appointmentTime && appointmentTime.split(':').length === 2) {
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
            appt.appointment_type_id || 1,
            appt.status || 'pending',
            appt.notes || '',
            appt.created_at || new Date().toISOString(),
            appt.updated_at || new Date().toISOString()
          ]
        );
        migratedAppointments++;
      } catch (err) {
        console.log(`  ⚠️  Failed to migrate appointment for customer ${appt.customer_id}: ${err.message}`);
      }
    }
    console.log(`  ✅ Migrated ${migratedAppointments} appointments`);

    // 3. Migrate leads
    console.log('\n📋 Migrating leads...');
    
    const leads = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM leads WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    console.log(`  Found ${leads.length} leads in SQLite`);

    let migratedLeads = 0;
    for (const lead of leads) {
      try {
        // Map studio_id 1 to 3
        const studioId = lead.studio_id === 1 ? 3 : lead.studio_id;
        
        // Check if lead already exists
        const [existing] = await connection.execute(
          'SELECT id FROM leads WHERE email = ? AND studio_id = ?',
          [lead.email, studioId]
        );
        
        if (existing.length === 0) {
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
          migratedLeads++;
        }
      } catch (err) {
        console.log(`  ⚠️  Failed to migrate lead ${lead.email}: ${err.message}`);
      }
    }
    console.log(`  ✅ Migrated ${migratedLeads} leads`);

    await connection.commit();
    console.log('\n✅ All data migrated successfully!');

    // Show final counts
    const [finalTypes] = await connection.execute('SELECT COUNT(*) as count FROM appointment_types WHERE studio_id = 3');
    const [finalAppts] = await connection.execute('SELECT COUNT(*) as count FROM appointments WHERE studio_id = 3');
    const [finalLeads] = await connection.execute('SELECT COUNT(*) as count FROM leads WHERE studio_id = 3');
    
    console.log('\n📊 Final counts for Studio 3:');
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