#!/usr/bin/env node

const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');

async function simpleImport() {
  console.log('🚀 Starting simple import (users only)...\n');

  // Railway MySQL config
  const config = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  };

  console.log(`📊 Connecting to MySQL: ${config.host}:${config.port}\n`);

  try {
    // Connect to MySQL
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to Railway MySQL\n');

    // Connect to SQLite
    const sqliteDb = new sqlite3.Database('./database.sqlite');
    const sqliteGet = promisify(sqliteDb.get.bind(sqliteDb));
    const sqliteAll = promisify(sqliteDb.all.bind(sqliteDb));

    console.log('✅ Connected to SQLite\n');

    // Import users first
    console.log('📤 Importing users...');
    const users = await sqliteAll('SELECT * FROM users');
    console.log(`   Found ${users.length} users in SQLite`);

    for (const user of users) {
      try {
        await connection.execute(`
          INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, is_active, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            email = VALUES(email),
            password_hash = VALUES(password_hash),
            role = VALUES(role),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            phone = VALUES(phone),
            is_active = VALUES(is_active),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at)
        `, [
          user.id,
          user.email,
          user.password_hash,
          user.role,
          user.first_name,
          user.last_name,
          user.phone,
          user.is_active,
          user.created_at,
          user.updated_at
        ]);
        console.log(`   ✓ Imported user: ${user.email}`);
      } catch (err) {
        console.log(`   ❌ Failed to import user ${user.email}: ${err.message}`);
      }
    }

    // Check current data
    console.log('\n📊 Verification...');
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`   Users in MySQL: ${userCount[0].count}`);

    // Check maxberger specifically
    const [maxUser] = await connection.execute('SELECT email, role FROM users WHERE email = ?', ['maxberger@ail.com']);
    if (maxUser.length > 0) {
      console.log(`   ✅ maxberger@ail.com found with role: ${maxUser[0].role}`);
    } else {
      console.log(`   ❌ maxberger@ail.com not found`);
    }

    sqliteDb.close();
    await connection.end();
    console.log('\n🎉 Simple import completed!');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Check if running through Railway
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.DB_HOST) {
  console.error('❌ This script must be run through Railway CLI:');
  console.error('   railway run node scripts/simple-import.js');
  process.exit(1);
}

simpleImport();