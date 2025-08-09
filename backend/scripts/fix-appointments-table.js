#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAppointmentsTable() {
  console.log('🔧 Fixing appointments table in MySQL database...\n');

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

    // Check if appointments table exists
    console.log('📋 Checking if appointments table exists...');
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointments'",
      [config.database]
    );

    if (tables.length === 0) {
      console.log('❌ appointments table does not exist. Creating it...');
      
      // Create the appointments table according to business requirements
      await connection.execute(`
        CREATE TABLE appointments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          studio_id INT NOT NULL,
          appointment_type_id INT,
          appointment_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          status ENUM('bestätigt', 'absolviert', 'nicht erschienen', 'storniert') DEFAULT 'bestätigt',
          cancelled_by ENUM('customer', 'studio', 'system') NULL,
          cancelled_at TIMESTAMP NULL,
          session_consumed BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_by_user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
          FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_studio_date (studio_id, appointment_date),
          INDEX idx_customer_date (customer_id, appointment_date),
          INDEX idx_appointment_datetime (appointment_date, start_time)
        )
      `);
      console.log('✅ appointments table created successfully');
    } else {
      console.log('✅ appointments table exists');
      
      // Check if all required columns exist
      const [columns] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointments'",
        [config.database]
      );
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      console.log('\n📊 Current columns:', columnNames.join(', '));
      
      // Add missing columns if needed
      if (!columnNames.includes('session_consumed')) {
        console.log('⚠️ Adding session_consumed column...');
        await connection.execute('ALTER TABLE appointments ADD COLUMN session_consumed BOOLEAN DEFAULT FALSE AFTER cancelled_at');
      }
      
      if (!columnNames.includes('cancelled_by')) {
        console.log('⚠️ Adding cancelled_by column...');
        await connection.execute("ALTER TABLE appointments ADD COLUMN cancelled_by ENUM('customer', 'studio', 'system') NULL AFTER status");
      }
      
      if (!columnNames.includes('cancelled_at')) {
        console.log('⚠️ Adding cancelled_at column...');
        await connection.execute('ALTER TABLE appointments ADD COLUMN cancelled_at TIMESTAMP NULL AFTER cancelled_by');
      }
    }

    // Check current appointments count
    console.log('\n📊 Checking appointments data:');
    const [appointmentCount] = await connection.execute('SELECT COUNT(*) as count FROM appointments');
    console.log(`   Total appointments: ${appointmentCount[0].count}`);
    
    if (appointmentCount[0].count > 0) {
      const [recentAppointments] = await connection.execute(`
        SELECT a.*, at.name as type_name, s.name as studio_name 
        FROM appointments a
        LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
        LEFT JOIN studios s ON a.studio_id = s.id
        ORDER BY a.created_at DESC
        LIMIT 5
      `);
      
      console.log('\n   Recent appointments:');
      recentAppointments.forEach(apt => {
        console.log(`   - ${apt.appointment_date} ${apt.start_time} - ${apt.type_name} at ${apt.studio_name} (Status: ${apt.status})`);
      });
    }

    await connection.end();
    console.log('\n🎉 Appointments table is ready!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the fix
fixAppointmentsTable();