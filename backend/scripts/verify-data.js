#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function verifyData() {
  console.log('🔍 Verifying Railway MySQL data...\n');

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

    // Check all table counts
    const tables = [
      'users',
      'studios', 
      'activation_codes',
      'appointments',
      'leads',
      'customer_sessions',
      'google_sheets_integrations',
      'manager_codes'
    ];

    console.log('📊 Current data in Railway MySQL:\n');
    
    for (const table of tables) {
      try {
        const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${result[0].count} records`);
      } catch (err) {
        console.log(`   ${table}: ❌ Table not found or error`);
      }
    }

    // Check specific important records
    console.log('\n📋 Key records check:\n');
    
    // Check maxberger's studio
    const [studios] = await connection.execute(
      'SELECT s.*, u.email as owner_email FROM studios s JOIN users u ON s.owner_id = u.id WHERE u.email = ?',
      ['maxberger@ail.com']
    );
    
    if (studios.length > 0) {
      console.log(`   ✅ Studio found for maxberger@ail.com:`);
      studios.forEach(studio => {
        console.log(`      - ${studio.name} (ID: ${studio.id}) in ${studio.city}`);
      });
    } else {
      console.log(`   ❌ No studio found for maxberger@ail.com`);
    }

    // Check customers with studios
    const [customers] = await connection.execute(`
      SELECT u.email, u.first_name, u.last_name, s.name as studio_name
      FROM users u
      LEFT JOIN activation_codes ac ON u.id = ac.used_by_user_id
      LEFT JOIN studios s ON ac.studio_id = s.id
      WHERE u.role = 'customer'
    `);
    
    console.log(`\n   📋 Customers (${customers.length} total):`);
    customers.forEach((customer, index) => {
      if (index < 5) { // Show first 5
        console.log(`      - ${customer.first_name} ${customer.last_name} (${customer.email}) → ${customer.studio_name || 'No studio'}`);
      }
    });
    if (customers.length > 5) {
      console.log(`      ... and ${customers.length - 5} more`);
    }

    await connection.end();
    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/verify-data.js');
  process.exit(1);
}

verifyData();