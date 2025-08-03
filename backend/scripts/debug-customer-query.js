#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function debugCustomerQuery() {
  console.log('🔍 Debugging customer queries for maxberger@ail.com...\n');

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

    // Get maxberger's user ID and studios
    const [maxUser] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ?',
      ['maxberger@ail.com']
    );
    
    if (maxUser.length === 0) {
      console.log('❌ maxberger@ail.com not found!');
      return;
    }
    
    const userId = maxUser[0].id;
    console.log(`📋 Found maxberger@ail.com with ID: ${userId}\n`);

    // Get studios owned by maxberger
    const [studios] = await connection.execute(
      'SELECT id, name, city FROM studios WHERE owner_id = ?',
      [userId]
    );
    
    console.log(`📋 Studios owned by maxberger (${studios.length} total):`);
    studios.forEach(studio => {
      console.log(`   - ${studio.name} (ID: ${studio.id}) in ${studio.city}`);
    });

    // This is the query that might be used to get customers
    console.log('\n📋 Query 1: Customers through activation codes (typical approach):');
    const studioIds = studios.map(s => s.id);
    
    if (studioIds.length > 0) {
      const placeholders = studioIds.map(() => '?').join(',');
      const [customersViaActivation] = await connection.execute(`
        SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, 
               ac.studio_id, s.name as studio_name
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        JOIN studios s ON ac.studio_id = s.id
        WHERE u.role = 'customer' 
        AND ac.studio_id IN (${placeholders})
        AND ac.is_used = 1
      `, studioIds);
      
      console.log(`   Found ${customersViaActivation.length} customers via activation codes:`);
      customersViaActivation.forEach(c => {
        console.log(`   - ${c.first_name} ${c.last_name} (${c.email}) → ${c.studio_name}`);
      });
    }

    // Alternative query - direct studio relationship (if exists)
    console.log('\n📋 Query 2: All customers in the system:');
    const [allCustomers] = await connection.execute(`
      SELECT u.id, u.email, u.first_name, u.last_name
      FROM users u
      WHERE u.role = 'customer'
    `);
    
    console.log(`   Found ${allCustomers.length} total customers in system`);

    // Check activation codes
    console.log('\n📋 Activation codes for maxberger\'s studios:');
    if (studioIds.length > 0) {
      const placeholders = studioIds.map(() => '?').join(',');
      const [codes] = await connection.execute(`
        SELECT ac.*, u.email as used_by_email
        FROM activation_codes ac
        LEFT JOIN users u ON ac.used_by_user_id = u.id
        WHERE ac.studio_id IN (${placeholders})
      `, studioIds);
      
      console.log(`   Found ${codes.length} activation codes:`);
      codes.forEach(code => {
        console.log(`   - Code: ${code.code}, Used: ${code.is_used ? 'Yes' : 'No'}, Used by: ${code.used_by_email || 'N/A'}`);
      });
    }

    // Check if there's a direct customer-studio relationship table
    console.log('\n📋 Checking for other customer relationships...');
    
    // Check appointments
    if (studioIds.length > 0) {
      const placeholders = studioIds.map(() => '?').join(',');
      const [appointments] = await connection.execute(`
        SELECT COUNT(DISTINCT customer_id) as customer_count
        FROM appointments
        WHERE studio_id IN (${placeholders})
      `, studioIds);
      
      console.log(`   Unique customers with appointments: ${appointments[0].customer_count}`);
    }

    await connection.end();
    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/debug-customer-query.js');
  process.exit(1);
}

debugCustomerQuery();