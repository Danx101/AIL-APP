#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting Railway MySQL migration...\n');

  // Use Railway's environment variables
  const config = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false }
  };

  console.log('📊 Database config:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}\n`);

  try {
    // Connect to MySQL
    console.log('🔌 Connecting to MySQL...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!\n');

    // Step 1: Run schema fixes
    console.log('📝 Step 1: Applying schema fixes...');
    const schemaSQL = await fs.readFile(path.join(__dirname, 'fix-mysql-schema.sql'), 'utf8');
    
    // Split by semicolon and filter out empty statements
    const schemaStatements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toUpperCase().startsWith('SHOW') && !s.toUpperCase().startsWith('DESCRIBE'));

    for (const statement of schemaStatements) {
      try {
        await connection.execute(statement);
        console.log(`   ✓ ${statement.substring(0, 50)}...`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN') {
          console.log(`   ⚠️  Column already exists (skipping)`);
        } else {
          console.error(`   ❌ Error: ${err.message}`);
        }
      }
    }
    console.log('✅ Schema fixes completed!\n');

    // Step 2: Check current data
    console.log('📊 Step 2: Checking current data...');
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [studioCount] = await connection.execute('SELECT COUNT(*) as count FROM studios');
    const [appointmentCount] = await connection.execute('SELECT COUNT(*) as count FROM appointments');
    
    console.log(`   Current users: ${userCount[0].count}`);
    console.log(`   Current studios: ${studioCount[0].count}`);
    console.log(`   Current appointments: ${appointmentCount[0].count}\n`);

    // Step 3: Import incremental data
    console.log('📤 Step 3: Importing incremental data...');
    const dataSQL = await fs.readFile(path.join(__dirname, '../migrations/data/incremental_export_fixed.sql'), 'utf8');
    
    // Remove SET statements and comments
    const dataStatements = dataSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toUpperCase().startsWith('SET'));

    let imported = 0;
    for (const statement of dataStatements) {
      if (statement.toUpperCase().startsWith('INSERT')) {
        try {
          await connection.execute(statement);
          imported++;
          if (imported % 10 === 0) {
            console.log(`   ✓ Imported ${imported} records...`);
          }
        } catch (err) {
          console.error(`   ❌ Import error: ${err.message}`);
          console.error(`      Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
    console.log(`✅ Import completed! Total statements processed: ${imported}\n`);

    // Step 4: Verify import
    console.log('✔️  Step 4: Verifying import...');
    const [newUserCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [newStudioCount] = await connection.execute('SELECT COUNT(*) as count FROM studios');
    const [newAppointmentCount] = await connection.execute('SELECT COUNT(*) as count FROM appointments');
    
    console.log(`   Users: ${userCount[0].count} → ${newUserCount[0].count}`);
    console.log(`   Studios: ${studioCount[0].count} → ${newStudioCount[0].count}`);
    console.log(`   Appointments: ${appointmentCount[0].count} → ${newAppointmentCount[0].count}`);

    // Check specific user
    const [maxUser] = await connection.execute('SELECT email, role FROM users WHERE email = ?', ['maxberger@ail.com']);
    if (maxUser.length > 0) {
      console.log(`\n✅ Found maxberger@ail.com with role: ${maxUser[0].role}`);
    }

    await connection.end();
    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/railway-migrate.js');
  process.exit(1);
}

runMigration();