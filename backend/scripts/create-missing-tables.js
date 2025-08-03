#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function createMissingTables() {
  console.log('🔧 Creating missing tables in Railway MySQL...\n');

  const config = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to Railway MySQL\n');

    // Create appointment_types table
    console.log('📋 Creating appointment_types table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS appointment_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration INT NOT NULL DEFAULT 60,
        color VARCHAR(7) DEFAULT '#007bff',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ appointment_types table created');

    // Create customer_sessions table
    console.log('\n📋 Creating customer_sessions table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        appointment_id INT,
        session_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ customer_sessions table created');

    // Create session_blocks table
    console.log('\n📋 Creating session_blocks table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS session_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        package_type VARCHAR(50) NOT NULL,
        total_sessions INT NOT NULL,
        used_sessions INT DEFAULT 0,
        remaining_sessions INT NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiry_date TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ session_blocks table created');

    // Create session_transactions table
    console.log('\n📋 Creating session_transactions table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS session_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        studio_id INT NOT NULL,
        session_block_id INT,
        transaction_type VARCHAR(50) NOT NULL,
        sessions_count INT NOT NULL,
        reason TEXT,
        created_by_user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
        FOREIGN KEY (session_block_id) REFERENCES session_blocks(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ session_transactions table created');

    // Insert default appointment types for each studio
    console.log('\n📝 Adding default appointment types for studios...');
    const [studios] = await connection.execute('SELECT id FROM studios');
    
    const defaultTypes = [
      { name: 'Erstbehandlung', description: 'Erste Behandlung für neue Kunden', duration: 90, color: '#28a745' },
      { name: 'Folgebehandlung', description: 'Reguläre Folgebehandlung', duration: 60, color: '#007bff' },
      { name: 'Kontrolltermin', description: 'Kurzer Kontrolltermin', duration: 30, color: '#6c757d' }
    ];

    for (const studio of studios) {
      for (const type of defaultTypes) {
        try {
          await connection.execute(
            'INSERT INTO appointment_types (studio_id, name, description, duration, color) VALUES (?, ?, ?, ?, ?)',
            [studio.id, type.name, type.description, type.duration, type.color]
          );
        } catch (err) {
          // Ignore duplicate errors
          if (!err.message.includes('Duplicate entry')) {
            console.error(`Error adding appointment type: ${err.message}`);
          }
        }
      }
    }
    console.log('✅ Default appointment types added');

    // Show final counts
    console.log('\n📊 Verifying new tables...');
    const tables = ['appointment_types', 'customer_sessions', 'session_blocks', 'session_transactions'];
    
    for (const table of tables) {
      const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result[0].count} records`);
    }

    await connection.end();
    console.log('\n🎉 Missing tables created successfully!');

  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/create-missing-tables.js');
  process.exit(1);
}

createMissingTables();