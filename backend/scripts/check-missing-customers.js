#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkMissingCustomers() {
  console.log('🔍 Checking for missing customers in MySQL...\n');

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

  const mysql2 = await mysql.createConnection(mysqlConfig);

  try {
    // Get all customers from SQLite
    const sqliteCustomers = await new Promise((resolve, reject) => {
      sqlite.all(`
        SELECT DISTINCT u.*, ac.studio_id, ac.code as activation_code
        FROM users u
        JOIN activation_codes ac ON u.id = ac.used_by_user_id
        WHERE u.role = 'customer'
        ORDER BY u.id
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`📊 SQLite customers: ${sqliteCustomers.length}`);

    // Get all customers from MySQL
    const [mysqlCustomers] = await mysql2.execute(`
      SELECT DISTINCT u.*, ac.studio_id, ac.code as activation_code
      FROM users u
      JOIN activation_codes ac ON u.id = ac.used_by_user_id
      WHERE u.role = 'customer'
      ORDER BY u.id
    `);

    console.log(`📊 MySQL customers: ${mysqlCustomers.length}\n`);

    // Find missing customers
    const mysqlEmails = new Set(mysqlCustomers.map(c => c.email));
    const missingCustomers = sqliteCustomers.filter(c => !mysqlEmails.has(c.email));

    if (missingCustomers.length > 0) {
      console.log(`⚠️  Found ${missingCustomers.length} missing customers:\n`);
      missingCustomers.forEach(c => {
        console.log(`- ${c.email} (${c.first_name} ${c.last_name}) - Studio ID: ${c.studio_id}`);
      });
    } else {
      console.log('✅ All customers are in MySQL!');
    }

    // Check Max's studio specifically
    console.log('\n🔍 Checking Max\'s Studio (maxberger@ail.com)...\n');

    // Get Max's user ID
    const [maxUser] = await mysql2.execute(
      'SELECT id FROM users WHERE email = ?',
      ['maxberger@ail.com']
    );

    if (maxUser.length > 0) {
      const maxUserId = maxUser[0].id;
      
      // Get Max's studios in MySQL
      const [maxStudios] = await mysql2.execute(
        'SELECT * FROM studios WHERE owner_id = ?',
        [maxUserId]
      );

      console.log(`📊 Max has ${maxStudios.length} studios in MySQL:`);
      maxStudios.forEach(s => {
        console.log(`  - Studio ${s.id}: ${s.name} (${s.city})`);
      });

      // Check customers for each studio
      for (const studio of maxStudios) {
        const [studioCustomers] = await mysql2.execute(`
          SELECT u.email, u.first_name, u.last_name
          FROM users u
          JOIN activation_codes ac ON u.id = ac.used_by_user_id
          WHERE ac.studio_id = ? AND u.role = 'customer'
        `, [studio.id]);

        console.log(`  - Studio ${studio.id} has ${studioCustomers.length} customers`);
      }
    }

    // Check activation codes
    console.log('\n🔍 Checking activation codes...\n');

    const sqliteACodes = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM activation_codes WHERE studio_id IN (1, 3)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const [mysqlACodes] = await mysql2.execute(
      'SELECT * FROM activation_codes WHERE studio_id IN (1, 3)'
    );

    console.log(`📊 SQLite activation codes for studios 1,3: ${sqliteACodes.length}`);
    console.log(`📊 MySQL activation codes for studios 1,3: ${mysqlACodes.length}`);

    // Show used vs unused codes
    const sqliteUsed = sqliteACodes.filter(c => c.is_used).length;
    const mysqlUsed = mysqlACodes.filter(c => c.is_used).length;
    
    console.log(`  SQLite: ${sqliteUsed} used, ${sqliteACodes.length - sqliteUsed} unused`);
    console.log(`  MySQL: ${mysqlUsed} used, ${mysqlACodes.length - mysqlUsed} unused`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    sqlite.close();
    await mysql2.end();
  }
}

checkMissingCustomers();