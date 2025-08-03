#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function applySchemaFixes() {
  console.log('🔧 Applying complete schema fixes to Railway MySQL...\n');

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

    // Schema fixes to apply
    const fixes = [
      // Fix leads table
      {
        name: 'Add phone_number to leads',
        sql: 'ALTER TABLE leads ADD COLUMN phone_number VARCHAR(20)',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'leads' AND column_name = 'phone_number' AND table_schema = DATABASE()"
      },
      {
        name: 'Copy phone to phone_number in leads',
        sql: 'UPDATE leads SET phone_number = phone WHERE phone_number IS NULL',
        skipCheck: true
      },
      
      // Fix studios table
      {
        name: 'Add cancellation_advance_hours to studios',
        sql: 'ALTER TABLE studios ADD COLUMN cancellation_advance_hours INT DEFAULT 48',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'studios' AND column_name = 'cancellation_advance_hours' AND table_schema = DATABASE()"
      },
      {
        name: 'Add postponement_advance_hours to studios',
        sql: 'ALTER TABLE studios ADD COLUMN postponement_advance_hours INT DEFAULT 48',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'studios' AND column_name = 'postponement_advance_hours' AND table_schema = DATABASE()"
      },
      {
        name: 'Add max_advance_booking_days to studios',
        sql: 'ALTER TABLE studios ADD COLUMN max_advance_booking_days INT DEFAULT 30',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'studios' AND column_name = 'max_advance_booking_days' AND table_schema = DATABASE()"
      },
      {
        name: 'Add settings_updated_at to studios',
        sql: 'ALTER TABLE studios ADD COLUMN settings_updated_at TIMESTAMP',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'studios' AND column_name = 'settings_updated_at' AND table_schema = DATABASE()"
      },
      
      // Fix manager_codes table
      {
        name: 'Add created_by_manager_id to manager_codes',
        sql: 'ALTER TABLE manager_codes ADD COLUMN created_by_manager_id INT',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'manager_codes' AND column_name = 'created_by_manager_id' AND table_schema = DATABASE()"
      },
      {
        name: 'Add intended_owner_name to manager_codes',
        sql: 'ALTER TABLE manager_codes ADD COLUMN intended_owner_name VARCHAR(255)',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'manager_codes' AND column_name = 'intended_owner_name' AND table_schema = DATABASE()"
      },
      {
        name: 'Add intended_city to manager_codes',
        sql: 'ALTER TABLE manager_codes ADD COLUMN intended_city VARCHAR(255)',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'manager_codes' AND column_name = 'intended_city' AND table_schema = DATABASE()"
      },
      {
        name: 'Add intended_studio_name to manager_codes',
        sql: 'ALTER TABLE manager_codes ADD COLUMN intended_studio_name VARCHAR(255)',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'manager_codes' AND column_name = 'intended_studio_name' AND table_schema = DATABASE()"
      },
      
      // Fix google_sheets_integrations table
      {
        name: 'Add last_sync_at to google_sheets_integrations',
        sql: 'ALTER TABLE google_sheets_integrations ADD COLUMN last_sync_at TIMESTAMP',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'google_sheets_integrations' AND column_name = 'last_sync_at' AND table_schema = DATABASE()"
      },
      {
        name: 'Add sync_status to google_sheets_integrations',
        sql: 'ALTER TABLE google_sheets_integrations ADD COLUMN sync_status VARCHAR(50)',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'google_sheets_integrations' AND column_name = 'sync_status' AND table_schema = DATABASE()"
      },
      {
        name: 'Add column_mapping to google_sheets_integrations',
        sql: 'ALTER TABLE google_sheets_integrations ADD COLUMN column_mapping TEXT',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'google_sheets_integrations' AND column_name = 'column_mapping' AND table_schema = DATABASE()"
      },
      {
        name: 'Add auto_sync_enabled to google_sheets_integrations',
        sql: 'ALTER TABLE google_sheets_integrations ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT TRUE',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'google_sheets_integrations' AND column_name = 'auto_sync_enabled' AND table_schema = DATABASE()"
      },
      {
        name: 'Add sync_frequency_minutes to google_sheets_integrations',
        sql: 'ALTER TABLE google_sheets_integrations ADD COLUMN sync_frequency_minutes INT DEFAULT 30',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'google_sheets_integrations' AND column_name = 'sync_frequency_minutes' AND table_schema = DATABASE()"
      },
      
      // Fix appointments table
      {
        name: 'Add appointment_type_id to appointments',
        sql: 'ALTER TABLE appointments ADD COLUMN appointment_type_id INT',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'appointments' AND column_name = 'appointment_type_id' AND table_schema = DATABASE()"
      },
      {
        name: 'Add start_time to appointments',
        sql: 'ALTER TABLE appointments ADD COLUMN start_time TIME',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'appointments' AND column_name = 'start_time' AND table_schema = DATABASE()"
      },
      {
        name: 'Add end_time to appointments',
        sql: 'ALTER TABLE appointments ADD COLUMN end_time TIME',
        checkSql: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'appointments' AND column_name = 'end_time' AND table_schema = DATABASE()"
      },
      {
        name: 'Update appointments status column type',
        sql: 'ALTER TABLE appointments MODIFY COLUMN status VARCHAR(50)',
        skipCheck: true
      }
    ];

    // Apply each fix
    for (const fix of fixes) {
      try {
        // Check if column already exists
        if (fix.checkSql) {
          const [result] = await connection.execute(fix.checkSql);
          if (result[0].count > 0) {
            console.log(`⏭️  ${fix.name} - Column already exists`);
            continue;
          }
        }
        
        // Apply the fix
        await connection.execute(fix.sql);
        console.log(`✅ ${fix.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏭️  ${fix.name} - Column already exists`);
        } else {
          console.log(`❌ ${fix.name} - Error: ${err.message}`);
        }
      }
    }

    // Show final table structures
    console.log('\n📊 Verifying table structures...\n');
    
    const tables = ['users', 'studios', 'leads', 'appointments', 'manager_codes'];
    for (const table of tables) {
      const [columns] = await connection.execute(`SHOW COLUMNS FROM ${table}`);
      console.log(`\n📋 ${table} table columns:`);
      columns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
    }

    await connection.end();
    console.log('\n🎉 Schema fixes completed!');

  } catch (error) {
    console.error('❌ Failed to apply schema fixes:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/apply-schema-fixes.js');
  process.exit(1);
}

applySchemaFixes();