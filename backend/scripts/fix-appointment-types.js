#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAppointmentTypes() {
  console.log('🔧 Fixing appointment types in MySQL database...\n');

  const config = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'abnehmen_app'
  };

  // Add SSL for production
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    config.ssl = { rejectUnauthorized: false };
  }

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL database\n');

    // First, check if the appointment_types table exists
    console.log('📋 Checking if appointment_types table exists...');
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types'",
      [config.database]
    );

    if (tables.length === 0) {
      console.log('❌ appointment_types table does not exist. Creating it...');
      
      // Create the appointment_types table with proper structure
      await connection.execute(`
        CREATE TABLE appointment_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          studio_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          duration_minutes INT NOT NULL,
          consumes_session BOOLEAN DEFAULT TRUE,
          is_probebehandlung BOOLEAN DEFAULT FALSE,
          max_per_customer INT DEFAULT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#28a745',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ appointment_types table created successfully');
    } else {
      console.log('✅ appointment_types table exists');
      
      // Check if duration_minutes column exists
      const [columns] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types' AND COLUMN_NAME = 'duration_minutes'",
        [config.database]
      );
      
      if (columns.length === 0) {
        console.log('⚠️ duration_minutes column missing. Adding it...');
        await connection.execute('ALTER TABLE appointment_types ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60 AFTER name');
        
        // Copy duration to duration_minutes if duration column exists
        const [durationCol] = await connection.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types' AND COLUMN_NAME = 'duration'",
          [config.database]
        );
        
        if (durationCol.length > 0) {
          await connection.execute('UPDATE appointment_types SET duration_minutes = duration');
          console.log('✅ Copied duration values to duration_minutes');
        }
      }
      
      // Check for consumes_session column
      const [consumesCol] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types' AND COLUMN_NAME = 'consumes_session'",
        [config.database]
      );
      
      if (consumesCol.length === 0) {
        console.log('⚠️ consumes_session column missing. Adding it...');
        await connection.execute('ALTER TABLE appointment_types ADD COLUMN consumes_session BOOLEAN DEFAULT TRUE AFTER duration_minutes');
      }
      
      // Check for is_probebehandlung column
      const [probeCol] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types' AND COLUMN_NAME = 'is_probebehandlung'",
        [config.database]
      );
      
      if (probeCol.length === 0) {
        console.log('⚠️ is_probebehandlung column missing. Adding it...');
        await connection.execute('ALTER TABLE appointment_types ADD COLUMN is_probebehandlung BOOLEAN DEFAULT FALSE AFTER consumes_session');
      }
      
      // Check for max_per_customer column
      const [maxCol] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointment_types' AND COLUMN_NAME = 'max_per_customer'",
        [config.database]
      );
      
      if (maxCol.length === 0) {
        console.log('⚠️ max_per_customer column missing. Adding it...');
        await connection.execute('ALTER TABLE appointment_types ADD COLUMN max_per_customer INT DEFAULT NULL AFTER is_probebehandlung');
      }
    }

    // Now check current appointment types
    console.log('\n📊 Current appointment types:');
    const [currentTypes] = await connection.execute(`
      SELECT at.*, s.name as studio_name 
      FROM appointment_types at
      JOIN studios s ON at.studio_id = s.id
      ORDER BY s.name, at.name
    `);
    
    if (currentTypes.length === 0) {
      console.log('   No appointment types found');
    } else {
      currentTypes.forEach(type => {
        console.log(`   Studio: ${type.studio_name} - ${type.name} (${type.duration_minutes} min, consumes: ${type.consumes_session}, probe: ${type.is_probebehandlung})`);
      });
    }

    // Get all active studios
    console.log('\n📝 Checking studios and adding required appointment types...');
    const [studios] = await connection.execute('SELECT id, name FROM studios WHERE is_active = 1');
    
    if (studios.length === 0) {
      console.log('❌ No active studios found!');
      await connection.end();
      return;
    }

    // Define the required appointment types according to business requirements
    const requiredTypes = [
      { 
        name: 'Behandlung', 
        duration_minutes: 60, 
        consumes_session: true, 
        is_probebehandlung: false,
        description: 'Standard Abnehmen im Liegen Behandlung', 
        color: '#28a745' 
      },
      { 
        name: 'Beratung', 
        duration_minutes: 20, 
        consumes_session: false, 
        is_probebehandlung: false,
        description: 'Kostenlose Beratung und Aufklärung', 
        color: '#17a2b8' 
      },
      { 
        name: 'Probebehandlung', 
        duration_minutes: 60, 
        consumes_session: false, 
        is_probebehandlung: true,
        max_per_customer: 1,
        description: 'Kostenlose Probebehandlung für Neukunden', 
        color: '#ffc107' 
      }
    ];

    for (const studio of studios) {
      console.log(`\n✨ Processing studio: ${studio.name}`);
      
      for (const type of requiredTypes) {
        // Check if this type already exists for this studio
        const [existing] = await connection.execute(
          'SELECT id FROM appointment_types WHERE studio_id = ? AND name = ?',
          [studio.id, type.name]
        );
        
        if (existing.length === 0) {
          // Insert the appointment type
          await connection.execute(
            `INSERT INTO appointment_types 
            (studio_id, name, duration_minutes, consumes_session, is_probebehandlung, max_per_customer, description, color) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              studio.id, 
              type.name, 
              type.duration_minutes, 
              type.consumes_session, 
              type.is_probebehandlung, 
              type.max_per_customer || null,
              type.description, 
              type.color
            ]
          );
          console.log(`   ✅ Added ${type.name}`);
        } else {
          // Update existing type to ensure correct settings
          await connection.execute(
            `UPDATE appointment_types 
            SET duration_minutes = ?, consumes_session = ?, is_probebehandlung = ?, 
                max_per_customer = ?, description = ?, color = ?
            WHERE id = ?`,
            [
              type.duration_minutes,
              type.consumes_session,
              type.is_probebehandlung,
              type.max_per_customer || null,
              type.description,
              type.color,
              existing[0].id
            ]
          );
          console.log(`   ✅ Updated ${type.name}`);
        }
      }
    }

    // Final check
    console.log('\n📊 Final appointment types count:');
    const [finalTypes] = await connection.execute(`
      SELECT s.name as studio_name, COUNT(*) as type_count 
      FROM appointment_types at
      JOIN studios s ON at.studio_id = s.id
      WHERE at.is_active = 1
      GROUP BY s.id, s.name
    `);
    
    finalTypes.forEach(result => {
      console.log(`   ${result.studio_name}: ${result.type_count} appointment types`);
    });

    await connection.end();
    console.log('\n🎉 Appointment types fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the fix
fixAppointmentTypes();