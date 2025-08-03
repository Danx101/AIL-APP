#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function importMissingCustomer() {
  console.log('📥 Importing missing customer...\n');

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

  const connection = await mysql.createConnection(mysqlConfig);

  try {
    // Get the missing customer from SQLite
    const customer = await new Promise((resolve, reject) => {
      sqlite.get(
        'SELECT * FROM users WHERE email = ?',
        ['testuser@example.com'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!customer) {
      console.log('❌ Customer not found in SQLite');
      return;
    }

    console.log(`Found customer: ${customer.email} (${customer.first_name} ${customer.last_name})`);

    // Check if customer already exists in MySQL
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [customer.email]
    );

    if (existing.length > 0) {
      console.log('⚠️  Customer already exists in MySQL');
      return;
    }

    // Insert the customer
    const [result] = await connection.execute(
      `INSERT INTO users (email, password, role, first_name, last_name, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.email,
        customer.password,
        customer.role,
        customer.first_name,
        customer.last_name,
        customer.phone || '',
        customer.created_at,
        customer.updated_at
      ]
    );

    console.log(`✅ Customer imported with ID: ${result.insertId}`);

    // Also check and import their activation code if it exists
    const activationCode = await new Promise((resolve, reject) => {
      sqlite.get(
        'SELECT * FROM activation_codes WHERE used_by_user_id = ?',
        [customer.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (activationCode) {
      // Update the activation code with the new user ID
      await connection.execute(
        `UPDATE activation_codes 
         SET used_by_user_id = ?, is_used = 1 
         WHERE code = ?`,
        [result.insertId, activationCode.code]
      );
      console.log(`✅ Updated activation code: ${activationCode.code}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    sqlite.close();
    await connection.end();
  }
}

importMissingCustomer();